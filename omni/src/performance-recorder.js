import { recordingType } from './capture.js';

// Draw the same two decks, stacking order and opacity used on the main stage.
// Fixed 720p output keeps a resize during a performance from changing the file.
export function drawPerformance(drawing, canvas, videos) {
  drawing.globalAlpha = 1;
  drawing.fillStyle = '#06222e';
  drawing.fillRect(0, 0, canvas.width, canvas.height);
  const layers = [...videos].sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0));
  for (const video of layers) {
    const opacity = Number(video.style.opacity || 0);
    if (!opacity || video.readyState < 2 || !video.videoWidth || !video.videoHeight) continue;
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale, height = video.videoHeight * scale;
    drawing.globalAlpha = opacity;
    drawing.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }
  drawing.globalAlpha = 1;
}

export function createPerformanceRecorder(player, onState, log) {
  let state = 'idle', take = null, recorder, stream, audio, paintTimer, clockTimer;
  let started = 0, chunks = [], error = null, finishTimer;
  const elapsed = () => Math.max(0, (performance.now() - started) / 1000);
  function update(message) { onState({ state, take, seconds: started ? elapsed() : 0, message }); }
  function release() {
    clearInterval(paintTimer); clearInterval(clockTimer); clearTimeout(finishTimer);
    if (recorder) {
      recorder.onstop = null; recorder.ondataavailable = null; recorder.onerror = null;
      if (recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* Already stopped. */ } }
    }
    stream?.getVideoTracks().forEach(track => track.stop());
    audio?.release(); audio = null; stream = null; recorder = null;
  }
  function fail(message) {
    release(); chunks = []; state = 'error'; update(message); log('Performance recording', message, 'error');
  }
  async function start() {
    if (['starting', 'recording', 'stopping'].includes(state)) return;
    if (!player.hasMedia) { update('Play a pad first, then press Record.'); return; }
    state = 'starting'; update('Starting recording…');
    try {
      const mimeType = recordingType();
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const drawing = canvas.getContext('2d', { alpha: false });
      if (!drawing || !canvas.captureStream) throw new Error('Video recording is unavailable in this browser. Try Chrome or Brave on the laptop.');
      audio = await player.captureAudio();
      const draw = () => drawPerformance(drawing, canvas, player.videos);
      draw(); stream = canvas.captureStream(24);
      stream.addTrack(audio.stream.getAudioTracks()[0]);
      chunks = []; error = null;
      const current = recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      current.onerror = event => {
        error = event.error?.message || 'The browser could not finish this recording.';
        stop();
      };
      current.onstop = () => {
        if (current !== recorder) return;
        const seconds = elapsed(), blob = new Blob(chunks, { type: current.mimeType });
        release(); chunks = [];
        if (error || !blob.size) { fail(error || 'The recording contains no video data. Your previous take is still available.'); return; }
        take = { blob, seconds, createdAt: new Date().toISOString() };
        state = 'ready'; update('Take ready. Save your video before closing.');
        log('Performance recording', `Take ready: ${seconds.toFixed(1)} seconds, ${blob.size} bytes. Includes pad video, crossfades and master audio.`);
      };
      current.start(1000); started = performance.now(); state = 'recording';
      paintTimer = setInterval(() => {
        try { draw(); } catch (problem) { error = `Could not draw the performance: ${problem.message}`; stop(); }
      }, 1000 / 24);
      clockTimer = setInterval(() => update('Recording your pad performance.'), 250);
      update('Recording your pad performance.');
      log('Performance recording', `Recording started at 1280×720 / 24 fps (${mimeType}). No Reactor request made.`);
    } catch (problem) { fail(problem.message); }
  }
  function stop() {
    if (state !== 'recording') return;
    state = 'stopping'; clearInterval(clockTimer); update('Finishing your video…');
    // Keep painting until the final data event; release only our recording taps.
    finishTimer = setTimeout(() => fail('Recording did not finish. Your previous take is still available.'), 10000);
    try { if (recorder.state !== 'inactive') recorder.stop(); }
    catch (problem) { fail(problem.message); }
  }
  function saved() { if (take) { state = 'ready'; update('Video download requested. Take remains available to Save again.'); } }
  return { start, stop, saved, get state() { return state; }, get take() { return take; } };
}
