// A visible MediaStream sink. This path does not construct a MediaRecorder.
export function createLivePreview(video, log, onFailure = () => {}, { onFirstFrame = () => {} } = {}) {
  let frameCount = 0, frameCallback, firstFrameTimer, label = '', running = false, attached = false, generation = 0;
  function clear() {
    running = false; generation++;
    clearTimeout(firstFrameTimer);
    if (frameCallback !== undefined) video.cancelVideoFrameCallback?.(frameCallback);
    frameCallback = undefined;
  }
  function fail(message) {
    if (!running) return;
    clear(); log('Live preview', message, 'error'); onFailure(message);
  }
  video.addEventListener('error', () => fail(`Video element error: ${video.error?.message || video.error?.code || 'unknown'}.`));
  function reset() {
    clear(); frameCount = 0; label = ''; attached = false;
    video.pause(); video.srcObject = null; video.poster = '';
    video.dataset.frames = '0'; video.hidden = true; video.load?.();
  }
  function attach(stream, name) {
    reset();
    label = name; running = true; attached = true;
    const epoch = generation;
    video.dataset.frames = '0'; video.hidden = false;
    video.muted = true; video.playsInline = true; video.controls = false;
    video.poster = '';
    video.srcObject = stream;
    log('Live preview', `${label}: attached to the main screen; waiting for a video frame. Audio uses the master mix.`);
    const frame = () => {
      if (!running || epoch !== generation) return;
      frameCount++; video.dataset.frames = String(frameCount);
      if (frameCount === 1) {
        clearTimeout(firstFrameTimer);
        log('Live preview', `${label}: FIRST VIDEO FRAME DISPLAYED (${video.videoWidth}×${video.videoHeight}). This verifies display, not saving.`);
        try { onFirstFrame(); } catch (error) { fail(error.message); return; }
      }
      frameCallback = video.requestVideoFrameCallback?.(frame);
    };
    if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(frame);
    else log('Live preview', 'This browser has no presented-frame callback. Inspect moving video directly.');
    firstFrameTimer = setTimeout(() => {
      if (!frameCount && video.requestVideoFrameCallback) fail(`${label}: no displayed video frame within 8 seconds. Ending the attempt.`);
    }, 8000);
    // Start consuming the stream before the server play command. Do not await
    // play() here: it can wait for the first frame, which that command produces.
    video.play().catch(error => {
      if (epoch === generation) fail(`${label}: browser play failed (${error.message}).`);
    });
  }
  function finish(reason) {
    if (!attached) return frameCount;
    attached = false;
    clear();
    video.pause(); video.srcObject = null; video.hidden = true; video.load?.();
    log('Preview summary', `${label || 'Live output'}: ${reason} Displayed frame callbacks: ${frameCount}. Performance recording is a separate user action.`);
    return frameCount;
  }
  return { attach, finish, reset, get frames() { return frameCount; } };
}

export function createPatternStream({ withAudio = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
  const drawing = canvas.getContext('2d');
  if (!drawing || !canvas.captureStream) throw new Error('Canvas live streams are unavailable in this browser.');
  let tick = 0;
  const draw = () => {
    drawing.fillStyle = '#123f50'; drawing.fillRect(0, 0, 640, 360);
    drawing.fillStyle = '#71e0ed'; drawing.fillRect((tick++ * 7) % 550, 70, 70, 140);
    drawing.fillStyle = 'white'; drawing.font = '24px sans-serif';
    drawing.fillText('FREE LIVE PATTERN', 140, 280);
    drawing.fillText(`Frame ${tick}`, 245, 320);
  };
  draw(); const stream = canvas.captureStream(24), timer = setInterval(draw, 1000/24);
  let audio, oscillator;
  if (withAudio) {
    audio = new AudioContext();
    const destination = audio.createMediaStreamDestination(), gain = audio.createGain();
    oscillator = audio.createOscillator(); oscillator.frequency.value = 330;
    gain.gain.value = .04; oscillator.connect(gain); gain.connect(destination);
    stream.addTrack(destination.stream.getAudioTracks()[0]); oscillator.start();
  }
  let stopped = false;
  return { stream, ready: audio?.resume() ?? Promise.resolve(), stop() {
    if (stopped) return; stopped = true;
    clearInterval(timer); oscillator?.stop(); stream.getTracks().forEach(track => track.stop());
    void audio?.close();
  } };
}
