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
  const bitmap = await createImageBitmap(pad.image);
  const { width, height } = bitmap; bitmap.close();
  if (width * height > 25000000 || width / height < .25 || width / height > 4) throw new Error('Use an image below 25 megapixels and between 1:4 and 4:1.');
  const url = URL.createObjectURL(pad.audio);
  try {
    const duration = await new Promise((resolve, reject) => {
      const audio = new Audio();
      const cleanup = () => { clearTimeout(timer); audio.removeAttribute('src'); audio.load(); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Could not read the audio reference.')); }, 10000);
      audio.onloadedmetadata = () => { const value = audio.duration; cleanup(); resolve(value); };
      audio.onerror = () => { cleanup(); reject(new Error('Could not read this audio format. Try WAV or MP3.')); };
      audio.src = url;
    });
    if (!Number.isFinite(duration) || duration < 2 || duration > 15.05) throw new Error('Choose a Daydream excerpt between 2 and 15 seconds.');
  } finally { URL.revokeObjectURL(url); }
}

export class OmniSession {
  constructor(onStatus) { this.onStatus = onStatus; this.reactor = null; this.epoch = 0; this.recorder = null; this.timer = null; }
  async connect() {
    if (this.reactor?.status === 'ready') return;
    const epoch = this.epoch;
    this.onStatus('Connecting to Reactor…');
    const response = await fetch('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const token = await response.json();
    if (!response.ok) throw new Error(token.error || 'Could not get a session token.');
    if (epoch !== this.epoch) throw new Error('Session ended.');
    const reactor = this.reactor = new Reactor({ modelName: 'reactor/fast-h3-omni' });
    this.events = new ClipEvents(); this.tracks = new Map(); this.commandError = null;
    reactor.on('message', message => this.events.push(message));
    reactor.on('trackReceived', (name, track) => this.tracks.set(name, track));
    reactor.on('error', error => { if (error.operation === 'sendCommand') this.commandError = error; });
    reactor.on('statusChanged', status => {
      if (status === 'waiting') this.onStatus('Waiting for Reactor… your current loop keeps playing.');
      if (status === 'disconnected') this.events.close('Reactor disconnected. Your local loops are still available.');
    });
    // A finite rehearsal session, not a monetary cap. End still explicitly
    // disconnects the SDK; stopping local playback alone does not do that.
    this.timer = setTimeout(() => { void this.end(); this.onStatus('Five-minute Reactor session ended. Local loops remain available.'); }, 300000);
    await reactor.connect(token.jwt);
    const deadline = Date.now() + 180000;
    while (reactor.status !== 'ready') {
      if (epoch !== this.epoch || Date.now() > deadline || reactor.status === 'disconnected') throw new Error('Reactor did not become ready.');
      await wait(100);
    }
    if (epoch !== this.epoch) throw new Error('Session ended.');
    await this.command('set_autoplay', { enabled: false });
  }
  async command(name, args = {}, expectsReply = true) {
    if (!this.reactor) throw new Error('Session ended.');
    this.commandError = null;
    const reply = await this.reactor.sendCommand(name, args);
    if (this.commandError) throw new Error(this.commandError.message || `${name} was refused.`);
    if (expectsReply && reply === undefined) throw new Error(`${name} was not accepted by Reactor.`);
    return reply;
  }
  async generate(pad, onPhase) {
    const mimeType = recordingType();
    const epoch = this.epoch;
    const assertCurrent = () => { if (epoch !== this.epoch) throw new Error('Session ended.'); };
    try {
      await validateMedia(pad); // Check local inputs before connecting or paying.
      assertCurrent();
      await this.connect(); assertCurrent();
      onPhase('Uploading references');
      const image = await this.reactor.uploadFile(pad.image); assertCurrent();
      const audio = await this.reactor.uploadFile(pad.audio); assertCurrent();
      const reply = await this.command('enqueue', {
        prompt: promptFor(pad), seconds: pad.seconds,
        reference_images: [image], reference_audios: [audio],
        metadata: JSON.stringify({ pad: pad.id, name: pad.name }),
      });
      const id = reply?.data?.clip?.clip_id;
      if (!id) throw new Error('Reactor did not return the queued clip ID.');
      onPhase('Generating');
      await this.events.wait('clip_generated', id); assertCurrent();
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
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.onerror = event => { recordingError = event.error || new Error('Recording failed.'); };
      });
      recorder.start(250);
      const startedAt = performance.now();
      await this.command('play', { clip_id: id }, false);
      await this.events.wait('clip_finished', id, 90000); assertCurrent();
      // clip_finished describes sent media, not browser presentation. Allow
      // transport drain. This v0.1 capture can include boundary padding; live
      // A/V alignment and loop seams need a laptop test, not a seamless claim.
      await wait(Math.max(1000, pad.seconds * 1000 + 1000 - (performance.now() - startedAt)));
      assertCurrent();
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await recorded;
      this.recorder = null;
      if (recordingError) throw recordingError;
      if (!blob.size) throw new Error('No playable media was captured.');
      return { blob, clipId: id, prompt: promptFor(pad), createdAt: new Date().toISOString() };
    } catch (error) {
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
    if (reactor) await reactor.disconnect().catch(() => {});
  }
}
