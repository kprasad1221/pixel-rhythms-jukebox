import { Reactor } from '@reactor-team/js-sdk';
import { ClipEvents } from './events.js';
import { validatePad, promptFor } from './pads.js';
import { trackState } from './capture.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
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
  constructor(onStatus, onActivity = () => {}, ReactorClient = Reactor, limits = {}) { this.onStatus = onStatus; this.onActivity = onActivity; this.ReactorClient = ReactorClient; this.reactor = null; this.epoch = 0; this.disconnectUnconfirmed = false; this.trackCleanups = []; this.attemptTimeoutMs = limits.attemptTimeoutMs ?? 25000; this.disconnectTimeoutMs = limits.disconnectTimeoutMs ?? 5000; this.inFlight = false; this.endPromise = null; this.onStream = limits.onStream ?? (() => {}); }
  log(stage, message, level = 'info') { this.onActivity(stage, message, level); }
  async checkInputs(pad) {
    this.phase = 'Local validation';
    this.log(this.phase, 'Reading local image dimensions and audio duration.');
    await validateMedia(pad);
  }
  async connect() {
    if (this.endPromise) throw new Error('Previous session cleanup is still running.');
    if (this.disconnectUnconfirmed) throw new Error('Previous session termination is unconfirmed. Check Reactor before opening another session.');
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
      if (message.type === 'clip_started') this.log('Reception', `clip_started for ${id}; Reactor is sending the passage. The live preview should now receive media; displayed frames are logged separately.`);
      if (message.type === 'clip_finished') this.log('Reception', `clip_finished for ${id}; Reactor reports media sent. Ending this single live-preview passage.`);
    });
    reactor.on('trackReceived', (name, track) => {
      this.tracks.set(name, track);
      this.log('Reception', `Output track available: ${name} · ${trackState(track)}. Track availability does not confirm media arrival.`);
      for (const event of ['unmute', 'mute', 'ended']) {
        const handler = () => this.log('Reception', `${name} ${event} · ${trackState(track)}`);
        track.addEventListener?.(event, handler);
        this.trackCleanups.push(() => track.removeEventListener?.(event, handler));
      }
    });
    reactor.on('error', error => {
      if (error.operation === 'sendCommand') this.commandError = error;
      this.log(this.phase || 'Connection', `SDK ${error.operation || 'error'} [${error.code || 'unknown'}]: ${error.message}`, 'error');
    });
    reactor.on('statusChanged', status => {
      this.log('Connection', `SDK status: ${status}.`);
      if (status === 'waiting') this.onStatus('Waiting for Reactor… your current loop keeps playing.');
      if (status === 'disconnected') this.events.close('Reactor disconnected. Your local loops are still available.');
    });
    // maxAttempts counts SDP-answer polls, not generation requests.
    // Preserve the SDK default; our overall deadline and server token bound time.
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
  async logIncomingMedia(label) {
    try {
      const pc = this.reactor?.getPeerConnection?.();
      if (!pc) { this.log('Incoming media', `${label}: peer-connection statistics unavailable.`); return; }
      const stats = await pc.getStats();
      let found = false;
      stats.forEach(stat => {
        if (stat.type !== 'inbound-rtp' || stat.isRemote) return;
        found = true;
        const fields = ['bytesReceived', 'packetsReceived', 'framesReceived', 'framesDecoded', 'totalSamplesReceived']
          .filter(key => Number.isFinite(stat[key])).map(key => `${key}=${stat[key]}`).join(', ');
        this.log('Incoming media', `${label} · ${stat.kind || stat.mediaType || 'track'} cumulative: ${fields || 'counts unavailable'}.`);
      });
      if (!found) this.log('Incoming media', `${label}: no inbound RTP statistics yet.`);
    } catch (error) { this.log('Incoming media', `${label}: statistics unavailable (${error.message}).`); }
  }
  async generate(pad, onPhase) {
    if (this.inFlight) throw new Error('An attempt is already running. No new request sent.');
    if (this.disconnectUnconfirmed) throw new Error('Previous session termination is unconfirmed. Check Reactor before another attempt.');
    this.inFlight = true;
    let deadline;
    try {
      const take = await Promise.race([
        this.runGeneration(pad, onPhase),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(new Error('Local attempt time limit reached. Stopping without retry; token requests a 30-second server session limit.')), this.attemptTimeoutMs);
        }),
      ]);
      clearTimeout(deadline);
      this.log('Connection', 'Live passage finished; terminating Reactor. No recording was requested.');
      await this.end();
      return take;
    } catch (error) {
      this.log('Attempt limit / error', error.message, 'error');
      await this.end();
      throw error;
    } finally {
      clearTimeout(deadline);
      this.inFlight = false;
    }
  }
  async runGeneration(pad, onPhase) {
    const epoch = this.epoch;
    const assertCurrent = () => { if (epoch !== this.epoch) throw new Error('Session ended.'); };
    try {
      await this.checkInputs(pad); // Check local inputs before connecting or paying.
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
      this.log('Generation', `Waiting for clip_generated for ${id} (within the overall attempt time limit).`);
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
      this.phase = 'Live preview';
      this.log('Live preview', 'Attaching incoming tracks directly to the visible video element. Recording is disabled.');
      this.onStream(media);
      assertCurrent();
      await this.logIncomingMedia('Before Reactor play'); assertCurrent();
      await this.command('play', { clip_id: id }, false);
      this.log('Reception', 'Play command sent; live video is displayed as it arrives. Waiting for clip_finished within the attempt limit.');
      await this.events.wait('clip_finished', id, 90000); assertCurrent();
      await this.logIncomingMedia('At clip_finished'); assertCurrent();
      return { clipId: id, source: 'reactor-live', seconds: pad.seconds };
    } catch (error) {
      this.log(this.phase || 'Local validation', `Stopped: ${error.message}`, 'error');
      // A timed-out operation can settle later; it must not end a newer session.
      if (epoch === this.epoch) await this.end();
      throw error;
    }
  }
  async end() {
    if (this.endPromise) return this.endPromise;
    this.endPromise = this.finishSession();
    try { return await this.endPromise; }
    finally { this.endPromise = null; }
  }
  async finishSession() {
    this.epoch++;
    this.events?.close();
    for (const cleanup of this.trackCleanups.splice(0)) {
      try { cleanup(); } catch { /* Listener cleanup must not prevent disconnect. */ }
    }
    const reactor = this.reactor; this.reactor = null;
    if (reactor) {
      this.log('Connection', 'Disconnect requested. In-flight charges are not cancelled by local playback stopping.');
      let timer;
      try {
        // Default/non-recoverable disconnect releases the session's GPU.
        await Promise.race([
          reactor.disconnect(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Disconnect confirmation timed out')), this.disconnectTimeoutMs); }),
        ]);
        this.disconnectUnconfirmed = false; this.log('Connection', 'SDK disconnect completed.');
      }
      catch (error) { this.disconnectUnconfirmed = true; this.log('Connection', `Disconnect failed: ${error.message}. Further attempts blocked; check Reactor account session state. Server token requested a 30-second limit.`, 'error'); }
      finally { clearTimeout(timer); }
    }
    return !this.disconnectUnconfirmed;
  }
}
