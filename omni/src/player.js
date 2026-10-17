import { installMeters } from './meters.js';
import { createLivePreview } from './live-preview.js';
export function createPlayer(onStatus, onPlaying, log = () => {}, onLiveFailure = () => {}) {
  const videos = [document.querySelector('#output'), document.querySelector('#incoming')];
  const liveVideo = document.querySelector('#live-preview');
  const allVideos = [...videos, liveVideo];
  const sourceBadge = document.querySelector('#output-source');
  const volume = document.querySelector('#volume');
  const pause = document.querySelector('#pause');
  let context, master, loops, liveGain, liveSource, liveTrack, liveEnded, gains, active = -1, busy = false, liveAttached = false, liveShowing = false;
  const livePreview = createLivePreview(liveVideo, log, message => {
    finishLive('Live display failed; returning to pads.'); onLiveFailure(message);
  }, { onFirstFrame() {
    liveShowing = true;
    liveVideo.style.opacity = 1;
    loops.gain.setValueAtTime(0, context.currentTime);
    liveGain.gain.setValueAtTime(1, context.currentTime);
    sourceBadge.hidden = false;
    document.querySelector('#empty').style.display = 'none';
    pause.disabled = true; pause.title = 'Live passage playing. Press a pad or End Reactor to return.';
    onStatus('Live output playing on the main screen. Press a pad to return to local playback.');
  } });
  const urls = new WeakMap();
  function unlock() {
    if (!context) {
      context = new AudioContext(); master = context.createGain(); master.gain.value = Number(volume.value); master.connect(context.destination);
      loops = context.createGain(); loops.connect(master);
      liveGain = context.createGain(); liveGain.gain.value = 0; liveGain.connect(master);
      gains = videos.map(video => { const gain = context.createGain(); gain.gain.value = 0; context.createMediaElementSource(video).connect(gain); gain.connect(loops); return gain; });
      installMeters(master, context, allVideos);
    }
    return context.resume();
  }
  function gain(index, value) { gains[index].gain.cancelScheduledValues(context.currentTime); gains[index].gain.setValueAtTime(value, context.currentTime); }
  async function play(blob, label, padId) {
    if (busy) throw new Error('Let this fade finish, then tap again.');
    busy = true; pause.disabled = true;
    const previous = active, next = previous === 0 ? 1 : 0, video = videos[next];
    let timer, errorHandler;
    try {
      const unlocked = unlock();
      gain(next, 0); video.style.opacity = 0; video.style.zIndex = 2;
      if (previous >= 0) videos[previous].style.zIndex = 1;
      if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
      video.src = urls.get(blob); video.load();
      onStatus(`Loading ${label}…`);
      const started = video.play();
      const failed = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Playback did not start. Try a smaller MP4 or tap again.')), 15000);
        errorHandler = () => reject(new Error('This clip could not play in your browser.'));
        video.addEventListener('error', errorHandler, { once: true });
      });
      await Promise.race([Promise.all([unlocked, started]), failed]);
      clearTimeout(timer); video.removeEventListener('error', errorHandler);
      const seconds = Number(document.querySelector('#fade-seconds').value), start = context.currentTime;
      onStatus(`Fading to ${label}…`);
      gain(next, previous < 0 ? 1 : 0);
      if (previous >= 0) { gain(previous, 1); gains[previous].gain.linearRampToValueAtTime(0, start + seconds); gains[next].gain.linearRampToValueAtTime(1, start + seconds); }
      await new Promise(resolve => {
        const frame = () => {
          const t = previous < 0 ? 1 : Math.min(1, (context.currentTime - start) / seconds);
          video.style.opacity = t;
          if (t < 1) requestAnimationFrame(frame); else resolve();
        }; frame();
      });
      if (previous >= 0) { videos[previous].pause(); videos[previous].style.opacity = 0; gain(previous, 0); }
      active = next;
      document.querySelector('#empty').style.display = 'none';
      pause.textContent = 'Pause';
      onStatus(`${label} — playing`); onPlaying(padId);
    } catch (error) {
      video.pause(); video.style.opacity = 0; if (gains) gain(next, 0);
      throw error;
    } finally {
      clearTimeout(timer); if (errorHandler) video.removeEventListener('error', errorHandler);
      busy = false; pause.disabled = active < 0 || liveShowing;
    }
  }
  volume.addEventListener('input', () => { volume.style.setProperty('--volume', `${Number(volume.value)*100}%`); document.querySelector('#volume-value').textContent = `${Math.round(Number(volume.value)*100)}%`; if (master) master.gain.setTargetAtTime(Number(volume.value), context.currentTime, .02); });
  pause.addEventListener('click', async () => {
    if (busy || active < 0 || liveShowing) return;
    if (videos[active].paused) {
      try { await unlock(); await videos[active].play(); pause.textContent = 'Pause'; } catch { onStatus('Tap Play again to enable sound.'); }
    } else { videos[active].pause(); pause.textContent = 'Play'; }
  });
  async function captureAudio() {
    await unlock();
    const destination = context.createMediaStreamDestination();
    master.connect(destination);
    return {
      stream: destination.stream,
      release() {
        master.disconnect(destination);
        destination.stream.getTracks().forEach(track => track.stop());
      },
    };
  }
  function attachLive(stream, label) {
    if (!context || context.state !== 'running') throw new Error('Tap again to enable the main audio output.');
    if (!liveVideo.requestVideoFrameCallback) throw new Error('This browser cannot verify live video frames. Use current Chrome or Brave on the laptop.');
    finishLive('Replacing live source.');
    liveAttached = true;
    liveVideo.style.opacity = 0; liveVideo.style.zIndex = 3;
    sourceBadge.textContent = `LIVE · ${label}`;
    try {
      if (stream.getAudioTracks().length) {
        liveSource = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        liveSource.connect(liveGain);
      }
      liveTrack = stream.getVideoTracks()[0];
      liveEnded = () => finishLive('Live stream ended; returned to pads.');
      liveTrack?.addEventListener('ended', liveEnded, { once: true });
      livePreview.attach(stream, label);
    } catch (error) { finishLive('Live attachment failed; returned to pads.'); throw error; }
  }
  function finishLive(reason) {
    const frames = livePreview.finish(reason);
    if (!liveAttached) return frames;
    liveAttached = false; liveShowing = false;
    liveTrack?.removeEventListener('ended', liveEnded); liveTrack = null;
    liveSource?.disconnect(); liveSource = null;
    liveVideo.style.opacity = 0; sourceBadge.hidden = true;
    if (context) { liveGain.gain.setValueAtTime(0, context.currentTime); loops.gain.setValueAtTime(1, context.currentTime); }
    document.querySelector('#empty').style.display = active < 0 ? '' : 'none';
    pause.disabled = active < 0 || busy; pause.title = '';
    pause.textContent = active >= 0 && videos[active].paused ? 'Play' : 'Pause';
    onStatus(active >= 0 ? 'Returned to local pad playback.' : 'Live passage ended. Choose a pad to play.');
    return frames;
  }
  function resetLive() { finishLive('Preparing another passage.'); livePreview.reset(); }
  return { play, unlock, captureAudio, attachLive, finishLive, resetLive, videos: allVideos,
    get liveFrames() { return livePreview.frames; }, get liveActive() { return liveAttached; },
    get hasMedia() { return active >= 0 || liveShowing; }, get busy() { return busy; } };
}
