import { installMeters } from './meters.js';
export function createPlayer(onStatus, onPlaying) {
  const videos = [document.querySelector('#output'), document.querySelector('#incoming')];
  const volume = document.querySelector('#volume');
  const pause = document.querySelector('#pause');
  let context, master, gains, active = -1, busy = false;
  const urls = new WeakMap();
  function unlock() {
    if (!context) {
      context = new AudioContext(); master = context.createGain(); master.gain.value = Number(volume.value); master.connect(context.destination);
      gains = videos.map(video => { const gain = context.createGain(); gain.gain.value = 0; context.createMediaElementSource(video).connect(gain); gain.connect(master); return gain; });
      installMeters(master, context, videos);
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
      busy = false; pause.disabled = active < 0;
    }
  }
  volume.addEventListener('input', () => { volume.style.setProperty('--volume', `${Number(volume.value)*100}%`); document.querySelector('#volume-value').textContent = `${Math.round(Number(volume.value)*100)}%`; if (master) master.gain.setTargetAtTime(Number(volume.value), context.currentTime, .02); });
  pause.addEventListener('click', async () => {
    if (busy || active < 0) return;
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
  return { play, unlock, captureAudio, videos, get hasMedia() { return active >= 0; }, get busy() { return busy; } };
}
