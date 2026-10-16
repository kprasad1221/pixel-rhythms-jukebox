// A visible MediaStream sink. This path does not construct a MediaRecorder.
export function createLivePreview(video, log, onFailure = () => {}) {
  let frameCount = 0, frameCallback, firstFrameTimer, label = '', running = false, generation = 0;
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
    clear(); frameCount = 0; label = '';
    video.pause(); video.srcObject = null; video.poster = '';
    video.dataset.frames = '0'; video.hidden = true; video.load?.();
  }
  function attach(stream, name) {
    reset();
    label = name; running = true;
    const epoch = generation;
    video.dataset.frames = '0'; video.hidden = false;
    video.muted = true; video.playsInline = true; video.controls = true;
    video.poster = '';
    video.srcObject = stream;
    log('Live preview', `${label}: stream attached directly; video starts muted. Recording disabled.`);
    const frame = () => {
      if (!running || epoch !== generation) return;
      frameCount++; video.dataset.frames = String(frameCount);
      if (frameCount === 1) {
        clearTimeout(firstFrameTimer);
        log('Live preview', `${label}: FIRST VIDEO FRAME DISPLAYED (${video.videoWidth}×${video.videoHeight}). This verifies display, not saving.`);
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
    clear();
    // Keep the last visible frame for review after the live tracks end.
    // This is a display snapshot, not a recorded clip or downloadable take.
    if (frameCount && video.videoWidth && globalThis.document && video.srcObject) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        video.poster = canvas.toDataURL('image/png');
        video.pause(); video.srcObject = null; video.load();
      } catch { /* Failure to retain a still must not block session cleanup. */ }
    }
    log('Preview summary', `${label || 'Preview'}: ${reason} Displayed frame callbacks: ${frameCount}. No recorded take was created.`);
    return frameCount;
  }
  return { attach, finish, reset, get frames() { return frameCount; } };
}

export function createPatternStream() {
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
  return { stream, stop() { clearInterval(timer); stream.getTracks().forEach(track => track.stop()); } };
}
