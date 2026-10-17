import { defaultPads, validatePad, padIssues, presetText, importPresetText } from './pads.js';
import { loadPads, savePads } from './store.js';
import { createPlayer } from './player.js';
import { createPerformanceRecorder } from './performance-recorder.js';
import { OmniSession } from './reactor.js';
import { testBrowserCapture } from './capture.js';
import { createPatternStream } from './live-preview.js';
import { createActivity, safeLogText } from './activity.js';

const $ = selector => document.querySelector(selector);
const status = text => { $('#status').textContent = text; };
const sessionStatus = text => { $('#session-status').textContent = text; };
const activity = createActivity($('#activity-log'));
let attemptNumber = 0, attemptContext = '', capturePreviewURL = null;
function report(stage, message, level = 'info') {
  activity.add(stage, message, level, attemptContext);
  const text = `${attemptContext ? attemptContext + ' · ' : ''}${stage}: ${safeLogText(message)}`;
  $('#attempt-status').textContent = text;
  $('#attempt-status').dataset.error = String(level === 'error');
  if (stage === 'Live preview' || (pending !== null && level === 'error')) { $('#live-preview-status').textContent = safeLogText(message); $('#live-preview-status').dataset.error = String(level === 'error'); }
  status(text);
}
function renderInputs() {
  $('#generate-label').textContent = `Live video check · Pad ${edited+1} · ${pads[edited].name}`;
  $('#input-issues').replaceChildren(...padIssues(pads[edited]).map(text => {
    const item = document.createElement('li'); item.textContent = text; return item;
  }));
}

let pads = defaultPads(), edited = 0, activePad = -1, pending = null, imagePreviewURL = null;
let persistence = true, liveDisplayChecked = false;
let liveAction = 0, liveWork = false, activePattern = null;
const takes = new Map();
const colors = ['54,204,234','166,146,228','72,161,213','88,195,191','211,182,111'];
const buttons = pads.map((pad, i) => {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'pad'; button.style.setProperty('--pad', colors[i%5]);
  const name = document.createElement('span'); name.className = 'pad-name'; name.textContent = String(i + 1);
  const key = document.createElement('span'); key.className = 'pad-key'; key.textContent = pad.key.toUpperCase();
  const mode = document.createElement('span'); mode.className = 'pad-mode'; button.append(name,key,mode);
  button.addEventListener('click', () => activate(i)); $('#buttons').append(button);
  return button;
});
const player = createPlayer(status, id => { activePad = id; renderPads(); }, report, () => {
  void stopLive('Live output stopped after a display error.').then(ended => sessionStatus(ended ? 'Reactor is off. Local playback is available.' : 'Disconnect could not be confirmed. Check Reactor session state.'));
});
const performanceRecorder = createPerformanceRecorder(player, ({ state, take, seconds, message }) => {
  const recording = state === 'recording';
  const finalizing = state === 'starting' || state === 'stopping';
  $('#record').textContent = recording ? '■ Stop' : state === 'starting' ? 'Starting…' : state === 'stopping' ? 'Finishing…' : '● Record';
  $('#record').setAttribute('aria-pressed', String(recording));
  $('#record').disabled = finalizing;
  $('#save-performance').disabled = !take || recording || finalizing;
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  $('#record-status').textContent = recording ? `Recording · ${duration}` : message;
  $('#record-status').dataset.error = String(state === 'error');
  $('#record-status').dataset.state = state;
}, (stage, message, level) => activity.add(stage, message, level));
$('#record').addEventListener('click', () => {
  if (performanceRecorder.state === 'recording') performanceRecorder.stop();
  else void performanceRecorder.start();
});
$('#save-performance').addEventListener('click', () => {
  const take = performanceRecorder.take; if (!take) return;
  const extension = take.blob.type.includes('mp4') ? 'mp4' : 'webm';
  download(take.blob, `pixel-rhythms-performance-${take.createdAt.replace(/[:.]/g, '-')}.${extension}`);
  performanceRecorder.saved();
  activity.add('Save', `Performance video download requested (${take.blob.size} bytes). Check your downloads.`);
});
const omni = new OmniSession(sessionStatus, report, undefined, {
  onStream: stream => player.attachLive(stream, `Reactor Pad ${pending + 1}`),
});
function showMainOutput() { $('#editor').open = false; window.scrollTo({ top: 0, behavior: 'auto' }); }
async function stopLive(reason) {
  liveAction++;
  player.finishLive(reason); activePattern?.stop(); activePattern = null;
  activity.add('Main output', reason);
  return omni.end();
}

function renderPads() {
  pads.forEach((pad, i) => {
    const button = buttons[i];
    button.querySelector('.pad-name').textContent = String(i + 1);
    button.querySelector('.pad-mode').textContent = pending === i ? 'Preparing' : `${pad.group}${takes.get(i)?.source === 'local-capture-test' ? ' · LOCAL TEST' : takes.has(i) ? ' · new take' : ''}`;
    button.setAttribute('aria-pressed', String(activePad === i));
    button.setAttribute('aria-label', `Pad ${i + 1}, key ${pad.key.toUpperCase()}`);
    button.classList.toggle('pending', pending === i);
    button.disabled = false;
  });
  $('#pad-count').textContent = `${pads.filter(p => p.clip).length}/10 loops · ${pads.filter(p => p.image && p.audio && p.prompt.trim()).length}/10 generation presets`;
  const take = takes.get(edited);
  $('#download-take').disabled = !take;
  $('#download-take').textContent = take?.source === 'local-capture-test' ? `Download Pad ${edited+1} test clip` : `Download Pad ${edited+1} latest take`;
  $('#test-capture').textContent = `Create free test clip for Pad ${edited+1}`;
  $('#take-status').textContent = take?.source === 'local-capture-test' ? `Pad ${edited+1} holds a temporary LOCAL TEST clip. Press Pad ${edited+1} to play it. Download it before reloading. Your original loop is still assigned.` : take ? `Pad ${edited+1} holds a captured Reactor take for this visit. Download before reloading.` : `Pad ${edited+1} has no temporary take. It uses its assigned existing loop.`;
  $('#generate-pad').disabled = pending !== null || !liveDisplayChecked;
  $('#generate-pad').title = liveDisplayChecked ? 'Upload references and watch one paid live passage.' : 'Show the free live pattern successfully first.';
  $('#check-inputs').disabled = pending !== null;
  $('#test-capture').disabled = pending !== null;
  $('#test-live').disabled = pending !== null;
}
function selectEditor(id) {
  edited = id; const pad = pads[id];
  $('#edit-pad').value = String(id); $('#pad-name').value = pad.name; $('#pad-group').value = pad.group; $('#pad-prompt').value = pad.prompt; $('#pad-seconds').value = String(pad.seconds);
  for (const kind of ['image','audio','clip']) { $(`#pad-${kind}`).value = ''; $(`#${kind}-name`).textContent = pad[kind]?.name || 'Nothing assigned yet'; }
  if (imagePreviewURL) URL.revokeObjectURL(imagePreviewURL);
  imagePreviewURL = pad.image ? URL.createObjectURL(pad.image) : null;
  $('#image-preview').hidden = !imagePreviewURL;
  if (imagePreviewURL) $('#image-preview').src = imagePreviewURL; else $('#image-preview').removeAttribute('src');
  renderPads(); renderInputs();
}
function rebuildOptions() {
  $('#edit-pad').replaceChildren(...pads.map(pad => { const option = document.createElement('option'); option.value = String(pad.id); option.textContent = `${pad.key.toUpperCase()} · ${pad.name} · ${pad.group}`; return option; }));
  $('#edit-pad').value = String(edited);
}
function readEditor() {
  const pad = pads[edited];
  pad.name = $('#pad-name').value.trim() || `Pad ${edited+1}`;
  pad.group = $('#pad-group').value.trim(); pad.prompt = $('#pad-prompt').value; pad.seconds = Number($('#pad-seconds').value);
  renderInputs();
}
async function save() {
  readEditor(); rebuildOptions(); renderPads();
  if (!persistence) { $('#editor-status').textContent = 'Browser storage is unavailable. Settings work for this visit; export them before closing.'; return; }
  try { await savePads(pads); $('#editor-status').textContent = 'Saved in this browser. Keep your original media files backed up.'; }
  catch { $('#editor-status').textContent = 'Browser storage could not save these files. They still work for this visit. Export settings and keep the originals.'; }
}
function openEditor(id) { readEditor(); rebuildOptions(); selectEditor(id); $('#editor').open = true; $('#editor').scrollIntoView({ block: 'nearest' }); }
function download(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function activate(id, existingOnly = false, explicitGenerate = false) {
  readEditor();
  const pad = { ...pads[id] }, label = `Pad ${id + 1}`;
  const generate = explicitGenerate;
  if (!generate) {
    const take = existingOnly ? null : takes.get(id);
    const media = existingOnly ? pad.clip : (take?.blob || pad.clip);
    const playbackLabel = take?.source === 'local-capture-test' ? `${label} · LOCAL TEST` : take ? `${label} · new take` : `${label} · original loop`;
    if (!media) { openEditor(id); status(`Choose an existing loop for ${label}, or prepare its generation references.`); return; }
    if (liveWork || player.liveActive) await stopLive('Pad pressed; returning to local playback and ending the live attempt.');
    activity.add('Playback', `Loading pad ${id+1} · ${playbackLabel}.`);
    try { await player.play(media, playbackLabel, id); activity.add('Playback', `Pad ${id+1}${take?.source === 'local-capture-test' ? ' LOCAL TEST' : ''} playing locally; fade completed.`); }
    catch (error) { status(error.message); activity.add('Playback', error.message, 'error'); }
    return;
  }
  if (pending !== null || player.busy) { status('Let the current request or fade finish first.'); activity.add('Local validation', 'Another request or fade is still active; no new request sent.'); return; }
  if (!liveDisplayChecked) { report('Local validation', 'Show free live pattern first. No connection or request made.', 'error'); return; }
  attemptContext = `Attempt ${++attemptNumber} / pad ${id+1} (${pad.name})`;
  report('Local validation', 'Checking assigned prompt, image, audio and duration.');
  try { validatePad(pad); }
  catch (error) {
    openEditor(id); report('Local validation', `${error.message} No connection or request made.`, 'error');
    $('#attempt-status').focus({ preventScroll: true }); $('#attempt-status').scrollIntoView({ block: 'nearest' }); return;
  }
  if (!$('#allow-generation').checked) {
    openEditor(id); report('Local validation', 'Assigned inputs pass basic checks. Paid generation is disabled; no connection, upload or request made. Use Check inputs for the free media check.', 'error');
    $('#attempt-status').focus({ preventScroll: true }); $('#attempt-status').scrollIntoView({ block: 'nearest' }); return;
  }
  $('#allow-generation').checked = false; // Consent applies to this attempt only.
  const action = ++liveAction; liveWork = true;
  pending = id; renderPads(); $('#working').hidden = false; $('#working-label').textContent = `Preparing ${pad.name}`;
  try {
    await player.unlock();
    if (action !== liveAction) return;
    player.resetLive(); showMainOutput();
    $('#live-preview-status').textContent = 'Preparing a live passage for the main screen. Your current loop keeps playing.';
    await omni.generate(pad, phase => { $('#working-label').textContent = `${phase} · Pad ${id + 1}`; sessionStatus(`${phase} · Pad ${id + 1}`); $('#live-preview-status').textContent = `${phase} · Pad ${id + 1}. Live output uses the main screen and optional performance recorder.`; });
    if (action !== liveAction) return;
    const frames = player.finishLive('Reactor passage ended.');
    report('Live preview', frames ? `Live passage displayed ${frames} frame callbacks on the main screen. Returned to pads. Use Record and Save video to keep a performance.` : 'The session ended without a displayed-frame callback. Live playback is not verified.');
    sessionStatus(omni.disconnectUnconfirmed ? 'Termination could not be confirmed. Check Reactor session state.' : 'Reactor disconnected. Local pad playback is available.');
  } catch (error) {
    if (action === liveAction) { report('Attempt stopped', `${error.message} Local playback retained. See the preceding stage for where it stopped.`, 'error'); sessionStatus(omni.disconnectUnconfirmed ? 'Disconnect could not be confirmed. Check Reactor session state.' : omni.reactor ? 'Reactor is still connected. Use End Reactor.' : 'Reactor is off.'); }
  } finally { player.finishLive('Attempt cleanup completed.'); liveWork = false; pending = null; $('#working').hidden = true; renderPads(); }
}

$('#arrange').addEventListener('click', () => { $('#editor').open = !$('#editor').open; if ($('#editor').open) $('#editor').scrollIntoView({ block: 'nearest' }); });
$('#edit-pad').addEventListener('change', event => { readEditor(); selectEditor(Number(event.target.value)); });
$('#save-pad').addEventListener('click', save);
for (const kind of ['image','audio','clip']) $(`#pad-${kind}`).addEventListener('change', async event => {
  if (!event.target.files[0]) return;
  readEditor(); pads[edited][kind] = event.target.files[0]; selectEditor(edited); await save();
});
$('#test-capture').addEventListener('click', async () => {
  if (pending !== null) return;
  readEditor();
  const id = edited;
  attemptContext = `Local capture check ${++attemptNumber} / pad ${id+1}`;
  if (omni.reactor) { report('Local capture test', 'End Reactor before running the free pad test.', 'error'); return; }
  if (takes.has(id) && takes.get(id).source !== 'local-capture-test') {
    report('Local capture test', 'This pad already has a generated take. Choose another pad for the local test so that take is retained.', 'error'); return;
  }
  $('#allow-generation').checked = false;
  pending = id; renderPads();
  const preview = $('#capture-test-preview');
  preview.pause(); preview.hidden = true; preview.removeAttribute('src'); preview.load();
  if (capturePreviewURL) URL.revokeObjectURL(capturePreviewURL);
  capturePreviewURL = null;
  try {
    const blob = await testBrowserCapture(report);
    takes.set(id, { blob, clipId: `local-test-${Date.now()}`, source: 'local-capture-test', seconds: 3,
      prompt: 'Synthetic local capture test: moving rectangle and 220 Hz tone. No Reactor generation or authored references used.', createdAt: new Date().toISOString() });
    capturePreviewURL = URL.createObjectURL(blob); preview.src = capturePreviewURL; preview.hidden = false; preview.load();
    report('Local capture test', `Recorded ${blob.size} bytes as pad ${id+1}’s temporary LOCAL TEST take. Paid generation is disabled. Press pad ${id+1}, then use Download test clip for that pad. Original media assignments are retained. This does not verify Reactor reception.`);
  } catch (error) { report('Local capture test', error.message, 'error'); }
  finally { pending = null; renderPads(); }
});
$('#capture-test-preview').addEventListener('playing', () => activity.add('Local capture test', 'Local test recording playback started. No Reactor connection made.'));
$('#test-live').addEventListener('click', async () => {
  if (pending !== null) return;
  if (omni.reactor || omni.disconnectUnconfirmed) { report('Live preview', 'End Reactor and confirm its session is closed before the free test.', 'error'); return; }
  $('#allow-generation').checked = false;
  attemptContext = `Free live check ${++attemptNumber}`;
  const action = ++liveAction; liveWork = true;
  pending = edited; renderPads();
  let pattern;
  try {
    await player.unlock();
    if (action !== liveAction) return;
    player.resetLive();
    pattern = activePattern = createPatternStream({ withAudio: true });
    await pattern.ready;
    if (action !== liveAction) return;
    showMainOutput();
    player.attachLive(pattern.stream, 'FREE LIVE PATTERN');
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (action !== liveAction) return;
    if (!player.liveFrames) throw new Error('No pattern frame was displayed. Do not enable generation.');
    liveDisplayChecked = true;
    const frames = player.finishLive('Three-second free pattern finished.');
    report('Live preview', `FREE LIVE PATTERN displayed ${frames} frame callbacks on the main screen with a soft tone. Returned to pads. No Reactor connection or upload was made.`);
  } catch (error) { if (action === liveAction) report('Live preview', error.message, 'error'); }
  finally { pattern?.stop(); if (activePattern === pattern) activePattern = null; player.finishLive('Free test cleanup completed.'); liveWork = false; pending = null; renderPads(); }
});
$('#generate-pad').addEventListener('click', () => activate(edited, false, true));
$('#check-inputs').addEventListener('click', async () => {
  if (pending !== null) return;
  readEditor();
  const id = edited, pad = { ...pads[id] };
  attemptContext = `Check ${++attemptNumber} / pad ${id+1} (${pad.name})`;
  pending = id; renderPads();
  try { await omni.checkInputs(pad); report('Local validation', 'Image and audio pass local checks. No connection, upload or request made. Reactor may still refuse a request.'); }
  catch (error) { report('Local validation', `${error.message} No connection, upload or request made.`, 'error'); }
  finally { pending = null; renderPads(); }
});
for (const selector of ['#pad-name', '#pad-group', '#pad-prompt', '#pad-seconds']) $(selector).addEventListener('input', readEditor);
$('#copy-log').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(activity.text()); $('#copy-status').textContent = 'Log copied. Review it before sharing.'; }
  catch { $('#copy-status').textContent = 'Copy unavailable. Select and copy the log text directly.'; }
});
$('#audition').addEventListener('click', () => activate(edited, true));
$('#end').addEventListener('click', async () => { $('#allow-generation').checked = false; const ended = await stopLive('End Reactor pressed; returned to local output.'); sessionStatus(ended ? 'Reactor is off. Local loops remain available.' : 'Disconnect could not be confirmed. Check Reactor session state.'); });
$('#download-take').addEventListener('click', () => {
  const take = takes.get(edited); if (!take) return;
  const name = `pad-${edited+1}-${take.clipId}`;
  download(take.blob, `${name}.${take.blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  const localTest = take.source === 'local-capture-test';
  download(new Blob([JSON.stringify({ ...presetText([pads[edited]]).pads[0],
    ...(localTest ? { files: { image: null, audio: null, clip: null } } : {}),
    source: take.source || 'reactor', seconds: take.seconds ?? pads[edited].seconds,
    clipId: take.clipId, prompt: take.prompt, createdAt: take.createdAt }, null, 2)], {type:'application/json'}), `${name}.json`);
  activity.add('Save', `Download requested for pad ${edited+1}${localTest ? ' LOCAL TEST' : ''}: video (${take.blob.size} bytes) and JSON record. Check your downloads to confirm the files were saved.`);
});
$('#export').addEventListener('click', () => { readEditor(); download(new Blob([JSON.stringify(presetText(pads), null, 2)], {type:'application/json'}), 'pixel-rhythms-pad-settings.json'); });
$('#import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { pads = importPresetText(JSON.parse(await file.text()), pads); rebuildOptions(); selectEditor(edited); await save(); }
  catch (error) { $('#editor-status').textContent = error.message; }
  event.target.value = '';
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  const id = pads.findIndex(pad => pad.key === event.key.toLowerCase());
  if (id >= 0) { event.preventDefault(); void activate(id); }
});
window.addEventListener('pagehide', () => { void stopLive('Page closing.'); });
// If the local server disappears, close the hosted session too. Do not assume
// Ctrl+C automatically closes an independent browser-to-Reactor connection.
setInterval(async () => {
  if (!omni.reactor) return;
  try { const result = await fetch('/api/config', { signal: AbortSignal.timeout(2500) }); if (!result.ok) throw new Error(); }
  catch { const ended = await stopLive('Local server stopped; returned to local output.'); sessionStatus(ended ? 'Local server stopped; Reactor disconnected.' : 'Local server stopped; disconnect could not be confirmed. Check Reactor session state.'); }
}, 5000);
try { pads = await loadPads(pads); } catch { persistence = false; }
rebuildOptions(); selectEditor(0);
activity.add('Local validation', 'App ready · SDK 3.1.0. No Reactor connection made. Saved pad storage unchanged.');
if (!pads.some(pad => pad.clip || pad.image)) $('#editor').open = true;
try { const config = await fetch('/api/config').then(r => r.json()); if (!config.configured) sessionStatus('Reactor key not configured. Local loop pads and free tests are available.'); }
catch { sessionStatus('Start the local server with npm run dev.'); }
if (!persistence) $('#editor-status').textContent = 'Browser storage is unavailable. This visit works; export settings before closing.';
