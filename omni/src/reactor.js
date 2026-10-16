import { Reactor } from '@reactor-team/js-sdk';
import { ClipEvents } from './events.js';
import { validatePad, promptFor } from './pads.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function recordingType() {
  if (!globalThis.MediaRecorder) throw new Error('This browser cannot capture incoming clips. Try Chrome on the laptop.');
  const type = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!type) throw new Error('No supported video recording format. Try Chrome on the laptop.');
  return type;
}
async function validateMedia(pad) {
  validatePad(pad);
  let bitmap;
  try { bitmap = await createImageBitmap(pad.image); }
  catch { throw new Error('Could not decode the Krea image. Choose a valid JPEG, PNG or WebP.'); }
  const { width, height } = bitmap; bitmap.close();
  if (width * height > 25000000 || width / height < .25 || width / height > 4) throw new Error('Use an image below 25 megapixels and between 1:4 and 4:1.');
  const url = URL.createObjectURL(pad.audio);
  try {
    const duration = await new Promise((resolve, reject) => {
      const audio = new Audio();
      const cleanup = () => { clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null; audio.removeAttribute('src'); audio.load(); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Could not read the audio reference.')); }, 10000);
      audio.onloadedmetadata = () => { const value = audio.duration; cleanup(); resolve(value); };
      audio.onerror = () => { cleanup(); reject(new Error('Could not read this audio format. Try WAV or MP3.')); };
      audio.src = url;
    });
    if (!Number.isFinite(duration) || duration < 2 || duration > 15.05) throw new Error('Choose a Daydream excerpt between 2 and 15 seconds.');
  } finally { URL.revokeObjectURL(url); }
}

export class OmniSession {
  constructor(onStatus, onActivity = () => {}, ReactorClient = Reactor) { this.onStatus = onStatus; this.onActivity = onActivity; this.ReactorClient = ReactorClient; this.reactor = null; this.epoch = 0; this.recorder = null; this.timer = null; this.disconnectUnconfirmed = false; }
  log(stage, message, level = 'info') { this.onActivity(stage, message, level); }
  async checkInputs(pad) {
    this.phase = 'Local validation';
    this.log(this.phase, 'Reading local image dimensions, audio duration and capture support.');
    recordingType();
    await validateMedia(pad);
  }
  async connect() {
    if (this.reactor?.getStatus() === 'ready') { this.log('Connection', 'Reusing ready Reactor session.'); return; }
    const epoch = this.epoch;
    this.phase = 'Connection';
    this.log(this.phase, 'Requesting scoped token from the local server.');
    this.onStatus('Connecting to Reactor…');
    const response = await fetch('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(25000) });
    const token = await response.json();
    if (!response.ok) throw new Error(token.error || 'Could not get a session token.');
    if (epoch !== this.epoch) throw new Error('Session ended.');
    this.log('Connection', 'Scoped token received; starting SDK connection. Token is not logged.');
    const reactor = this.reactor = new this.ReactorClient({ modelName: 'reactor/fast-h3-omni' });
    this.events = new ClipEvents(); this.tracks = new Map(); this.commandError = null;
    reactor.on('message', message => {
      this.events.push(message);
      const id = message?.data?.clip?.clip_id;
      if (message.type === 'clip_generated') this.log('Generation', `clip_generated received for ${id}; ready for stream reception.`);
      if (message.type === 'clip_failed') this.log('Generation', `clip_failed for ${id}: ${message.data.reason || 'No reason provided.'}`, 'error');
      if (message.type === 'clip_started') this.log('Reception', `clip_started for ${id}; Reactor is sending the passage. Local Jukebox playback has not started.`);
      if (message.type === 'clip_finished') this.log('Reception', `clip_finished for ${id}; Reactor reports media sent. Finishing browser capture.`);
    });
    reactor.on('trackReceived', (name, track) => { this.tracks.set(name, track); this.log('Reception', `Output track available: ${name} (${track.kind}).`); });
    reactor.on('error', error => {
      if (error.operation === 'sendCommand') this.commandError = error;
      this.log(this.phase || 'Connection', `SDK ${error.operation || 'error'} [${error.code || 'unknown'}]: ${error.message}`, 'error');
    });
    reactor.on('statusChanged', status => {
      this.log('Connection', `SDK status: ${status}.`);
      if (status === 'waiting') this.onStatus('Waiting for Reactor… your current loop keeps playing.');
      if (status === 'disconnected') this.events.close('Reactor disconnected. Your local loops are still available.');
    });
    // A finite rehearsal session, not a monetary cap. End still explicitly
    // disconnects the SDK; stopping local playback alone does not do that.
    this.timer = setTimeout(async () => { const ended = await this.end(); this.onStatus(ended ? 'Five-minute Reactor session ended. Local loops remain available.' : 'Disconnect could not be confirmed. Check Reactor session state.'); }, 300000);
    await reactor.connect(token.jwt);
    this.log('Connection', `SDK connect call completed; current status: ${reactor.getStatus()}.`);
    const deadline = Date.now() + 180000;
    while (reactor.getStatus() !== 'ready') {
      if (epoch !== this.epoch || Date.now() > deadline || reactor.getStatus() === 'disconnected') throw new Error('Reactor did not become ready.');
      await wait(100);
    }
    if (epoch !== this.epoch) throw new Error('Session ended.');
    this.log('Connection', 'Confirming autoplay is disabled; awaiting set_autoplay reply.');
    await this.command('set_autoplay', { enabled: false });
    this.log('Connection', 'Session ready; autoplay disabled.');
  }
  async command(name, args = {}, expectsReply = true) {
    if (!this.reactor) throw new Error('Session ended.');
    this.commandError = null;
    const reply = await this.reactor.sendCommand(name, args);
    if (this.commandError) throw new Error(`${name} [${this.commandError.code || 'refused'}]: ${this.commandError.message || 'Command refused.'}`);
    if (expectsReply && reply === undefined) throw new Error(`${name} was not accepted by Reactor.`);
    return reply;
  }
  async generate(pad, onPhase) {
    const epoch = this.epoch;
    const assertCurrent = () => { if (epoch !== this.epoch) throw new Error('Session ended.'); };
    try {
      await this.checkInputs(pad); // Check local inputs before connecting or paying.
      const mimeType = recordingType();
      this.log('Local validation', 'Local media checks passed.');
      assertCurrent();
      await this.connect(); assertCurrent();
      this.phase = 'Upload';
      onPhase('Uploading references');
      this.log('Upload', 'Uploading Krea image (1/2).');
      const image = await this.reactor.uploadFile(pad.image); assertCurrent();
      this.log('Upload', 'Krea image upload completed. Uploading Daydream audio (2/2).');
      const audio = await this.reactor.uploadFile(pad.audio); assertCurrent();
      this.log('Upload', 'Daydream audio upload completed. Both upload references received.');
      this.phase = 'Request';
      this.log('Request', `Sending enqueue for one ${pad.seconds}-second passage; awaiting acceptance.`);
      const reply = await this.command('enqueue', {
        prompt: promptFor(pad), seconds: pad.seconds,
        reference_images: [image], reference_audios: [audio],
        metadata: JSON.stringify({ pad: pad.id, name: pad.name }),
      });
      const id = reply?.data?.clip?.clip_id;
      if (reply?.type !== 'clip_queued' || !id) throw new Error('Reactor did not return clip_queued with a clip ID. Acceptance is unverified.');
      assertCurrent();
      this.log('Request acceptance', `clip_queued received: ${id}. Accepted is not generated.`);
      this.phase = 'Generation';
      this.log('Generation', `Waiting for clip_generated for ${id} (up to 180 seconds).`);
      onPhase('Generating');
      await this.events.wait('clip_generated', id); assertCurrent();
      this.phase = 'Reception';
      this.log('Reception', 'Generation complete. Waiting for both output tracks (up to 15 seconds).');
      const tracksDeadline = Date.now() + 15000;
      while (!this.tracks.get('main_video') || !this.tracks.get('main_audio')) {
        assertCurrent();
        if (Date.now() > tracksDeadline) throw new Error('Reactor did not provide both output tracks.');
        await wait(100);
      }
      onPhase('Receiving passage');
      const media = new MediaStream([this.tracks.get('main_video'), this.tracks.get('main_audio')]);
      const recorder = this.recorder = new MediaRecorder(media, { mimeType, videoBitsPerSecond: 6000000 });
      const chunks = [];
      let recordingError;
      const recorded = new Promise(resolve => {
        recorder.ondataavailable = event => { if (event.data.size) { if (!chunks.length) this.log('Reception', 'First nonempty recorded media chunk received. Playability still needs verification.'); chunks.push(event.data); } };
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.onerror = event => { recordingError = event.error || new Error('Recording failed.'); this.log('Capture', recordingError.message, 'error'); };
      });
      this.phase = 'Capture';
      recorder.start(250);
      this.log('Capture', `MediaRecorder started (${mimeType}); requesting Reactor stream playback.`);
      const startedAt = performance.now();
      await this.command('play', { clip_id: id }, false);
      this.log('Reception', 'Play command sent; awaiting clip_finished (up to 90 seconds). This is offstage stream reception.');
      await this.events.wait('clip_finished', id, 90000); assertCurrent();
      // clip_finished describes sent media, not browser presentation. Allow
      // transport drain. This v0.1 capture can include boundary padding; live
      // A/V alignment and loop seams need a laptop test, not a seamless claim.
      await wait(Math.max(1000, pad.seconds * 1000 + 1000 - (performance.now() - startedAt)));
      assertCurrent();
      if (recorder.state !== 'inactive') recorder.stop();
      let captureTimer;
      const blob = await Promise.race([recorded, new Promise((_, reject) => { captureTimer = setTimeout(() => reject(new Error('Browser capture did not finish within 10 seconds.')), 10000); })]).finally(() => clearTimeout(captureTimer));
      this.recorder = null;
      if (recordingError) throw recordingError;
      if (!blob.size) throw new Error('No playable media was captured.');
      this.log('Capture', `Captured ${blob.size} bytes (${blob.type}). Local playback has not been verified yet.`);
      return { blob, clipId: id, prompt: promptFor(pad), createdAt: new Date().toISOString() };
    } catch (error) {
      this.log(this.phase || 'Local validation', `Stopped: ${error.message}`, 'error');
      await this.end();
      throw error;
    }
  }
  async end() {
    this.epoch++;
    clearTimeout(this.timer);
    this.events?.close();
    if (this.recorder?.state !== 'inactive' && this.recorder) this.recorder.stop();
    this.recorder = null;
    const reactor = this.reactor; this.reactor = null;
    if (reactor) {
      this.log('Connection', 'Disconnect requested. In-flight charges are not cancelled by local playback stopping.');
      try { await reactor.disconnect(); this.disconnectUnconfirmed = false; this.log('Connection', 'SDK disconnect completed.'); }
      catch (error) { this.disconnectUnconfirmed = true; this.log('Connection', `Disconnect failed: ${error.message}. Check Reactor account session state.`, 'error'); }
    }
    return !this.disconnectUnconfirmed;
  }
}
