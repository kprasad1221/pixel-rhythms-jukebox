import { defaultPads, validatePad, padIssues, presetText, importPresetText } from './pads.js';
import { loadPads, savePads } from './store.js';
import { createPlayer } from './player.js';
import { OmniSession } from './reactor.js';
import { testBrowserCapture } from './capture.js';
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
  status(text);
}
function renderInputs() {
  $('#generate-label').textContent = `Generate pad ${edited+1} · ${pads[edited].name}`;
  $('#input-issues').replaceChildren(...padIssues(pads[edited]).map(text => {
    const item = document.createElement('li'); item.textContent = text; return item;
  }));
}

let pads = defaultPads(), edited = 0, activePad = -1, pending = null, imagePreviewURL = null;
let persistence = true;
const takes = new Map();
const colors = ['54,204,234','166,146,228','72,161,213','88,195,191','211,182,111'];
const buttons = pads.map((pad, i) => {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'pad'; button.style.setProperty('--pad', colors[i%5]);
  const name = document.createElement('span'); name.className = 'pad-name';
  const key = document.createElement('span'); key.className = 'pad-key'; key.textContent = pad.key.toUpperCase();
  const mode = document.createElement('span'); mode.className = 'pad-mode'; button.append(name,key,mode);
  button.addEventListener('click', () => activate(i)); $('#buttons').append(button);
  return button;
});
const player = createPlayer(status, id => { activePad = id; renderPads(); });
const omni = new OmniSession(sessionStatus, report);

function renderPads() {
  const generating = $('#play-mode').value === 'generate';
  pads.forEach((pad, i) => {
    const button = buttons[i];
    button.querySelector('.pad-name').textContent = pad.name;
    button.querySelector('.pad-mode').textContent = pending === i ? 'Preparing' : `${pad.group}${takes.has(i) ? ' · new take' : ''}`;
    button.setAttribute('aria-pressed', String(activePad === i));
    button.setAttribute('aria-label', `${pad.name}, ${pad.group}, key ${pad.key.toUpperCase()}`);
    button.classList.toggle('pending', pending === i);
    button.disabled = generating && pending !== null;
  });
  $('#pad-count').textContent = `${pads.filter(p => p.clip).length}/10 loops · ${pads.filter(p => p.image && p.audio && p.prompt.trim()).length}/10 generation presets`;
  $('#download-take').disabled = !takes.has(edited);
  $('#generate-pad').disabled = pending !== null;
  $('#check-inputs').disabled = pending !== null;
  $('#test-capture').disabled = pending !== null;
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
  const pad = { ...pads[id] }, label = `${pad.name} · ${pad.group}`;
  const generate = explicitGenerate || (!existingOnly && $('#play-mode').value === 'generate');
  if (!generate) {
    const media = existingOnly ? pad.clip : (takes.get(id)?.blob || pad.clip);
    if (!media) { openEditor(id); status(`Choose an existing loop for ${label}, or prepare its generation references.`); return; }
    activity.add('Playback', `Loading pad ${id+1} · ${label}.`);
    try { await player.play(media, label, id); activity.add('Playback', `Pad ${id+1} playing locally; fade completed.`); }
    catch (error) { status(error.message); activity.add('Playback', error.message, 'error'); }
    return;
  }
  if (pending !== null || player.busy) { status('Let the current request or fade finish first.'); activity.add('Local validation', 'Another request or fade is still active; no new request sent.'); return; }
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
  pending = id; renderPads(); $('#working').hidden = false; $('#working-label').textContent = `Preparing ${pad.name}`;
  try {
    // Unlock local sound during the pad gesture, before the network wait.
    report('Playback', 'Unlocking browser audio for eventual local playback.');
    await player.unlock();
    const take = await omni.generate(pad, phase => { $('#working-label').textContent = `${phase} · ${pad.name}`; sessionStatus(`${phase} · ${pad.name}`); });
    takes.set(id, take); renderPads();
    $('#working-label').textContent = `Ready · ${pad.name}`;
    report('Playback', 'Loading captured passage into the local Jukebox.');
    try { await player.play(take.blob, `${label} · new take`, id); report('Playback', 'Local playback started and fade completed.'); }
    catch (error) { report('Playback', `${error.message} Captured take retained: choose Play loops and tap this pad to retry, or Save latest take.`, 'error'); }
    sessionStatus('Passage received. Reactor remains connected until End Reactor or the five-minute timeout.');
  } catch (error) { report('Attempt stopped', `${error.message} Current local clip retained. See the preceding stage for where it stopped.`, 'error'); sessionStatus(omni.disconnectUnconfirmed ? 'Disconnect could not be confirmed. Check Reactor session state.' : omni.reactor ? 'Reactor is still connected. Use End Reactor.' : 'Reactor is off.'); }
  finally { pending = null; $('#working').hidden = true; renderPads(); }
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
  attemptContext = `Local capture check ${++attemptNumber}`;
  pending = edited; renderPads();
  const preview = $('#capture-test-preview');
  preview.pause(); preview.hidden = true; preview.removeAttribute('src'); preview.load();
  if (capturePreviewURL) URL.revokeObjectURL(capturePreviewURL);
  capturePreviewURL = null;
  try {
    const blob = await testBrowserCapture(report);
    capturePreviewURL = URL.createObjectURL(blob); preview.src = capturePreviewURL; preview.hidden = false; preview.load();
    report('Local capture test', `Recorded ${blob.size} bytes. Press Play on the LOCAL test video to check the moving pattern. This does not verify Reactor media reception.`);
  } catch (error) { report('Local capture test', error.message, 'error'); }
  finally { pending = null; renderPads(); }
});
$('#capture-test-preview').addEventListener('playing', () => activity.add('Local capture test', 'Local test recording playback started. No Reactor connection made.'));
$('#generate-pad').addEventListener('click', () => activate(edited, false, true));
$('#check-inputs').addEventListener('click', async () => {
  if (pending !== null) return;
  readEditor();
  const id = edited, pad = { ...pads[id] };
  attemptContext = `Check ${++attemptNumber} / pad ${id+1} (${pad.name})`;
  pending = id; renderPads();
  try { await omni.checkInputs(pad); report('Local validation', 'Inputs and browser capture support pass local checks. No connection, upload or request made. Reactor may still refuse a request.'); }
  catch (error) { report('Local validation', `${error.message} No connection, upload or request made.`, 'error'); }
  finally { pending = null; renderPads(); }
});
for (const selector of ['#pad-name', '#pad-group', '#pad-prompt', '#pad-seconds']) $(selector).addEventListener('input', readEditor);
$('#copy-log').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(activity.text()); $('#copy-status').textContent = 'Log copied. Review it before sharing.'; }
  catch { $('#copy-status').textContent = 'Copy unavailable. Select and copy the log text directly.'; }
});
$('#audition').addEventListener('click', () => activate(edited, true));
$('#play-mode').addEventListener('change', () => { renderPads(); if ($('#play-mode').value === 'generate') { status('Generate variations: pads request a new passage when paid generation is enabled. Arrange pads also has an explicit Generate button and free Check inputs.'); } });
$('#end').addEventListener('click', async () => { $('#allow-generation').checked = false; activity.add('Connection', 'End Reactor pressed.'); const ended = await omni.end(); sessionStatus(ended ? 'Reactor is off. Local loops remain available.' : 'Disconnect could not be confirmed. Check Reactor session state.'); });
$('#download-take').addEventListener('click', () => {
  const take = takes.get(edited); if (!take) return;
  const name = `pad-${edited+1}-${take.clipId}`;
  download(take.blob, `${name}.${take.blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  download(new Blob([JSON.stringify({ ...presetText([pads[edited]]).pads[0], clipId: take.clipId, prompt: take.prompt, createdAt: take.createdAt }, null, 2)], {type:'application/json'}), `${name}.json`);
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
window.addEventListener('pagehide', () => { void omni.end(); });
// If the local server disappears, close the hosted session too. Do not assume
// Ctrl+C automatically closes an independent browser-to-Reactor connection.
setInterval(async () => {
  if (!omni.reactor) return;
  try { const result = await fetch('/api/config', { signal: AbortSignal.timeout(2500) }); if (!result.ok) throw new Error(); }
  catch { const ended = await omni.end(); sessionStatus(ended ? 'Local server stopped; Reactor disconnected.' : 'Local server stopped; disconnect could not be confirmed. Check Reactor session state.'); }
}, 5000);
try { pads = await loadPads(pads); } catch { persistence = false; }
rebuildOptions(); selectEditor(0);
activity.add('Local validation', 'App ready · SDK 3.1.0. No Reactor connection made. Saved pad storage unchanged.');
if (!pads.some(pad => pad.clip || pad.image)) $('#editor').open = true;
try { const config = await fetch('/api/config').then(r => r.json()); if (!config.configured) sessionStatus('Reactor key not configured. Arrange pads and Play loops are ready to use.'); }
catch { sessionStatus('Start the local server with npm run dev.'); }
if (!persistence) $('#editor-status').textContent = 'Browser storage is unavailable. This visit works; export settings before closing.';
