export function recordingType() {
  if (!globalThis.MediaRecorder) throw new Error('This browser cannot capture incoming clips. Try Chrome on the laptop.');
  const type = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!type) throw new Error('No supported video recording format. Try Chrome on the laptop.');
  return type;
}

export function trackState(track) {
  return `${track.kind}: state=${track.readyState ?? 'unknown'}, enabled=${track.enabled ?? 'unknown'}, muted=${track.muted ?? 'unknown'}`;
}

// Shared by the real incoming stream and the entirely local browser self-test.
export function startCapture(stream, log) {
  const mimeType = recordingType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
  const chunks = [];
  let recordingError, emptyEvents = 0;
  const stopped = new Promise(resolve => {
    recorder.ondataavailable = event => {
      if (event.data.size) {
        if (!chunks.length) log('Capture', `First nonempty recorder chunk: ${event.data.size} bytes.`);
        chunks.push(event.data);
      } else {
        emptyEvents++;
        if (emptyEvents === 1) log('Capture', 'Recorder emitted an empty data chunk.');
      }
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = event => {
      recordingError = event.error || new Error('Recording failed.');
      log('Capture', `Recorder error: ${recordingError.message}`, 'error');
    };
  });
  for (const track of stream.getTracks()) log('Capture', `Input track · ${trackState(track)}`);
  recorder.start(250);
  log('Capture', `MediaRecorder start called (${mimeType}); state=${recorder.state}.`);
  return {
    recorder,
    async finish() {
      log('Capture', `Stopping recorder; state=${recorder.state}.`);
      if (recorder.state !== 'inactive') recorder.stop();
      let timer;
      const blob = await Promise.race([
        stopped,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Browser capture did not finish within 10 seconds.')), 10000); }),
      ]).finally(() => clearTimeout(timer));
      log('Capture', `Recorder stopped: ${chunks.length} nonempty chunks, ${emptyEvents} empty events, ${blob.size} bytes.`);
      if (recordingError) throw recordingError;
      if (!blob.size) throw new Error('No media bytes were captured. See input-track state and Incoming media counts in this log.');
      return blob;
    },
  };
}

// No file upload, network call, microphone or camera access.
export async function testBrowserCapture(log) {
  recordingType();
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
  const drawing = canvas.getContext('2d');
  if (!canvas.captureStream || !drawing) throw new Error('This browser cannot run the local canvas capture test.');
  const audio = new AudioContext();
  let stream, oscillator, interval, capture;
  try {
    await audio.resume();
    if (audio.state !== 'running') throw new Error('Browser audio did not start for the local capture test.');
    const destination = audio.createMediaStreamDestination();
    oscillator = audio.createOscillator(); oscillator.frequency.value = 220;
    const gain = audio.createGain(); gain.gain.value = 0.04;
    oscillator.connect(gain); gain.connect(destination); // never connected to speakers
    let frame = 0;
    const draw = () => {
      drawing.fillStyle = '#123f50'; drawing.fillRect(0,0,320,180);
      drawing.fillStyle = '#71e0ed'; drawing.fillRect((frame++ * 5) % 280,45,40,70);
      drawing.fillStyle = '#fff'; drawing.font = '16px sans-serif'; drawing.fillText('LOCAL CAPTURE TEST',55,145);
    };
    draw(); stream = canvas.captureStream(24);
    stream.addTrack(destination.stream.getAudioTracks()[0]);
    oscillator.start(); interval = setInterval(draw, 1000/24);
    log('Local capture test', 'Recording a three-second moving pattern and synthesized tone. No Reactor connection or uploads.');
    capture = startCapture(stream, log);
    await new Promise(resolve => setTimeout(resolve,3000));
    return await capture.finish();
  } finally {
    clearInterval(interval);
    if (capture?.recorder.state !== 'inactive' && capture) capture.recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    try { oscillator?.stop(); } catch { /* Oscillator may not have started if setup failed. */ }
    await audio.close();
  }
}
