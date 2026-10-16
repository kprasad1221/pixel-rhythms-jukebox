import { defaultPads, validatePad, presetText, importPresetText } from './pads.js';
import { loadPads, savePads } from './store.js';
import { createPlayer } from './player.js';
import { OmniSession } from './reactor.js';

const $ = selector => document.querySelector(selector);
const status = text => { $('#status').textContent = text; };
const sessionStatus = text => { $('#session-status').textContent = text; };
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
const omni = new OmniSession(sessionStatus);

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
}
function selectEditor(id) {
  edited = id; const pad = pads[id];
  $('#edit-pad').value = String(id); $('#pad-name').value = pad.name; $('#pad-group').value = pad.group; $('#pad-prompt').value = pad.prompt; $('#pad-seconds').value = String(pad.seconds);
  for (const kind of ['image','audio','clip']) { $(`#pad-${kind}`).value = ''; $(`#${kind}-name`).textContent = pad[kind]?.name || 'Nothing assigned yet'; }
  if (imagePreviewURL) URL.revokeObjectURL(imagePreviewURL);
  imagePreviewURL = pad.image ? URL.createObjectURL(pad.image) : null;
  $('#image-preview').hidden = !imagePreviewURL;
  if (imagePreviewURL) $('#image-preview').src = imagePreviewURL; else $('#image-preview').removeAttribute('src');
  renderPads();
}
function rebuildOptions() {
  $('#edit-pad').replaceChildren(...pads.map(pad => { const option = document.createElement('option'); option.value = String(pad.id); option.textContent = `${pad.key.toUpperCase()} · ${pad.name} · ${pad.group}`; return option; }));
  $('#edit-pad').value = String(edited);
}
function readEditor() {
  const pad = pads[edited];
  pad.name = $('#pad-name').value.trim() || `Pad ${edited+1}`;
  pad.group = $('#pad-group').value.trim(); pad.prompt = $('#pad-prompt').value; pad.seconds = Number($('#pad-seconds').value);
}
async function save() {
  readEditor(); rebuildOptions(); renderPads();
  if (!persistence) { $('#editor-status').textContent = 'Browser storage is unavailable. Settings work for this visit; export them before closing.'; return; }
  try { await savePads(pads); $('#editor-status').textContent = 'Saved in this browser. Keep your original media files backed up.'; }
  catch { $('#editor-status').textContent = 'Browser storage could not save these files. They still work for this visit. Export settings and keep the originals.'; }
}
function openEditor(id) { readEditor(); rebuildOptions(); selectEditor(id); $('#editor').open = true; $('#editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
function download(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function activate(id, existingOnly = false) {
  readEditor();
  const pad = { ...pads[id] }, label = `${pad.name} · ${pad.group}`;
  const generate = !existingOnly && $('#play-mode').value === 'generate';
  if (!generate) {
    const media = existingOnly ? pad.clip : (takes.get(id)?.blob || pad.clip);
    if (!media) { openEditor(id); status(`Choose an existing loop for ${label}, or prepare its generation references.`); return; }
    try { await player.play(media, label, id); } catch (error) { status(error.message); }
    return;
  }
  if (pending !== null || player.busy) { status('Let the current request or fade finish first.'); return; }
  if (!$('#allow-generation').checked) { status('Enable paid generation below the pads when you are ready to test.'); return; }
  try { validatePad(pad); } catch (error) { openEditor(id); status(error.message); return; }
  pending = id; renderPads(); $('#working').hidden = false; $('#working-label').textContent = `Preparing ${pad.name}`;
  try {
    // Unlock local sound during the pad gesture, before the network wait.
    await player.unlock();
    const take = await omni.generate(pad, phase => { $('#working-label').textContent = `${phase} · ${pad.name}`; sessionStatus(`${phase} · ${pad.name}`); });
    takes.set(id, take); renderPads();
    $('#working-label').textContent = `Ready · ${pad.name}`;
    try { await player.play(take.blob, `${label} · new take`, id); }
    catch { status('Your new take is ready. Select Play loops and tap its pad to start it.'); }
    sessionStatus('Passage received. Reactor remains connected until End Reactor or the five-minute timeout.');
  } catch (error) { status(`${error.message} Your current local clip is retained.`); sessionStatus('Reactor is off.'); }
  finally { pending = null; $('#working').hidden = true; renderPads(); }
}

$('#arrange').addEventListener('click', () => { $('#editor').open = !$('#editor').open; if ($('#editor').open) $('#editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
$('#edit-pad').addEventListener('change', event => { readEditor(); selectEditor(Number(event.target.value)); });
$('#save-pad').addEventListener('click', save);
for (const kind of ['image','audio','clip']) $(`#pad-${kind}`).addEventListener('change', async event => {
  if (!event.target.files[0]) return;
  readEditor(); pads[edited][kind] = event.target.files[0]; selectEditor(edited); await save();
});
$('#audition').addEventListener('click', () => activate(edited, true));
$('#play-mode').addEventListener('change', () => { $('#live-note').hidden = $('#play-mode').value !== 'generate'; renderPads(); });
$('#end').addEventListener('click', async () => { $('#allow-generation').checked = false; await omni.end(); sessionStatus('Reactor is off. Local loops remain available.'); });
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
  catch { await omni.end(); sessionStatus('Local server stopped; Reactor disconnected.'); }
}, 5000);
try { pads = await loadPads(pads); } catch { persistence = false; }
rebuildOptions(); selectEditor(0);
if (!pads.some(pad => pad.clip || pad.image)) $('#editor').open = true;
try { const config = await fetch('/api/config').then(r => r.json()); if (!config.configured) sessionStatus('Reactor key not configured. Arrange pads and Play loops are ready to use.'); }
catch { sessionStatus('Start the local server with npm run dev.'); }
if (!persistence) $('#editor-status').textContent = 'Browser storage is unavailable. This visit works; export settings before closing.';
