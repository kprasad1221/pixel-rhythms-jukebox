// Dependency-free startup checks. DOM/canvas are stubs, not a playback or GPU test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../archive/two-deck-study.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const tick = () => new Promise(resolve => setImmediate(resolve));
function scene(id) {
  return { id, plate_thumb: 'thumb.png', voices: [{ file: 'loop.mp4', ref: 'ref.png', thumb: 'thumb.png' }], beds: [{ file: 'bed.wav' }] };
}
const pack = () => ({ scenes: [scene('court'), scene('grove-roots')] });

async function run(fetcher, protocol = 'http:') {
  const nodes = new Map(), events = {}, requests = [];
  let audioContexts = 0;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: '', disabled: selector === '#start', dataset: { d: '1' },
      style: { setProperty() {} }, classList: { add() {}, remove() {} },
      listeners: {}, children: [],
      addEventListener(name, handler) { this.listeners[name] = handler; },
      querySelectorAll() { return []; },
      getContext(type) { return type === 'webgl' ? null : { createImageData: (w,h) => ({ data: new Uint8Array(w*h*4) }) }; }
    });
    return nodes.get(selector);
  }
  node('#cue-panel').parentNode = node('.side');
  const context = vm.createContext({
    document: { querySelector: node, querySelectorAll: s => s === '.dtab' ? [node('.dtab')] : [], addEventListener: (n,h) => events[n] = h },
    location: { protocol },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    window: { AudioContext: class { constructor() { audioContexts++; throw Error('Unexpected audio start'); } } },
    fetch: async (path, options) => { requests.push({ path, options }); return fetcher(path, options); },
    setTimeout, clearTimeout, performance,
    requestAnimationFrame() { throw Error('Rendering must not start before setup succeeds'); }
  });
  vm.runInContext(source, context);
  await tick();
  return { node, events, requests, audioContexts: () => audioContexts };
}

async function failed(fetcher, pattern, protocol) {
  const app = await run(fetcher, protocol);
  assert.equal(app.node('#start').disabled, true);
  assert.equal(app.node('#start strong').textContent, 'Scene pack not ready');
  assert.match(app.node('#status').textContent, pattern);
  assert.equal(app.audioContexts(), 0);
  return app;
}

test('missing manifest explains which file to recover', () => failed(() => ({ ok: false }), /Missing mixer\/data.json/));
test('opening the HTML directly gives local-server instructions', async () => {
  const app = await failed(() => { throw Error('Unexpected fetch'); }, /local server/, 'file:');
  assert.equal(app.requests.length, 0);
});
test('malformed JSON gives a useful error', () => failed(() => ({ ok: true, json: async () => { throw SyntaxError(); } }), /not valid JSON/));
test('invalid scene list is rejected before media requests', () => failed(() => ({ ok: true, json: async () => ({ scenes: [] }) }), /non-empty scenes/));
test('missing built-in scene is explained', () => failed(() => ({ ok: true, json: async () => ({ scenes: [scene('court')] }) }), /grove-roots/));
test('more than four voices is rejected', () => {
  const data = pack(); data.scenes[0].voices = Array(5).fill(data.scenes[0].voices[0]);
  return failed(() => ({ ok: true, json: async () => data }), /1–4 voices/);
});
test('missing media is named and checked with HEAD only', async () => {
  const app = await failed((path) => path === 'data.json' ? { ok: true, json: async () => pack() } : { ok: path !== 'loop.mp4' }, /Missing or inaccessible media \(1\): loop.mp4/);
  assert.equal(app.requests.length, 5); // duplicate paths across scenes checked once
  assert.ok(app.requests.slice(1).every(r => r.options.method === 'HEAD'));
});
test('available media still requires WebGL', () => failed(path => path === 'data.json' ? { ok: true, json: async () => pack() } : { ok: true }, /WebGL is unavailable/));
test('early deck, scene and Start inputs cannot start audio', async () => {
  let finish;
  const app = await run(() => new Promise(resolve => finish = resolve));
  app.node('.dtab').listeners.click();
  await app.node('#start').listeners.click();
  for (const key of [' ', '1']) app.events.keydown({ key, target: { closest: () => false }, preventDefault() {} });
  assert.equal(app.audioContexts(), 0);
  finish({ ok: false });
  await tick();
  assert.match(app.node('#status').textContent, /Missing mixer\/data.json/);
});
