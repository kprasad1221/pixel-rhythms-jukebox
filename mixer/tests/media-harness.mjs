// Runs the actual app and DOM with simulated media, audio clock and GPU.
// This verifies interaction/lifecycle logic, not rendering or sound quality.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { parseHTML } = require(process.env.TEST_DOM_MODULE_PATH || 'linkedom');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const config = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

export async function harness({ noGL = false } = {}) {
  const { window, document } = parseHTML(html);
  const $ = s => document.querySelector(s);
  const clock = { time: 0, state: 'suspended' }, urls = new Map(), textures = new Set(), captures = [];
  const sources = [], fetches = [], timers = new Map();
  let raf, timerId = 0, urlId = 0, wall = 0;
  const name = path => urls.get(path)?.name || path;
  const fails = path => String(name(path)).startsWith('bad-');
  const noOp = () => {};
  const gl = new Proxy({
    createTexture() { const t = {}; textures.add(t); return t; },
    deleteTexture(t) { textures.delete(t); },
    getShaderParameter: () => true, getProgramParameter: () => true,
    texImage2D(...args) { const image = args.at(-1); if (image?.tagName === 'VIDEO') captures.push(image.src); },
    createShader: () => ({}), createProgram: () => ({}), createFramebuffer: () => ({}), createBuffer: () => ({}),
    getUniformLocation: (_, key) => key,
    readPixels: (...args) => args.at(-1).fill(100)
  }, { get: (target, key) => key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? 0 : noOp });
  const ctx2d = new Proxy({}, { get: (o,k) => k in o ? o[k] : noOp });
  for (const canvas of document.querySelectorAll('canvas')) {
    canvas.getContext = type => type === 'webgl' ? noGL ? null : gl : ctx2d;
    canvas.getBoundingClientRect = () => ({ width: 256, height: 128 });
  }
  for (const select of document.querySelectorAll('select')) {
    let value = select.querySelector('option[selected]')?.getAttribute('value') || '';
    Object.defineProperty(select, 'value', { get: () => value, set: v => value = String(v) });
  }
  for (const input of document.querySelectorAll('input[type=file]')) {
    let files = [];
    Object.defineProperty(input, 'files', { get: () => files, set: v => files = v });
    Object.defineProperty(input, 'value', { get: () => files[0]?.name || '', set: v => { if (!v) files = []; } });
  }
  const createElement = document.createElement.bind(document);
  document.createElement = tag => {
    const el = createElement(tag);
    if (tag === 'video') {
      let src = '';
      Object.assign(el, { readyState: 2, videoWidth: 896, videoHeight: 512, currentTime: 0, paused: true });
      el.play = async () => { el.paused = false; }; el.pause = () => { el.paused = true; }; el.load = noOp;
      Object.defineProperty(el, 'src', { get: () => src, set: path => {
        src = path; el.setAttribute('src', path);
        queueMicrotask(() => el.dispatchEvent(new window.Event(fails(path) ? 'error' : 'loadeddata')));
      }});
    }
    return el;
  };
  class Image {
    set src(path) { if (path) queueMicrotask(() => fails(path) ? this.onerror?.() : this.onload?.()); }
  }
  const param = () => ({ value: 1, setValueAtTime: noOp, linearRampToValueAtTime: noOp, setTargetAtTime: noOp });
  class AudioContext {
    get currentTime() { return clock.time; } get state() { return clock.state; }
    async resume() { clock.state = 'running'; } async suspend() { clock.state = 'suspended'; }
    createGain() { return { gain: param(), connect: noOp }; }
    createAnalyser() { return { fftSize: 1024, connect: noOp, getFloatTimeDomainData: a => a.fill(0.1) }; }
    createChannelSplitter() { return { connect: noOp }; }
    async decodeAudioData(data) { if (fails(data.path)) throw Error('Unsupported audio'); return { duration: 3.84 }; }
    createBufferSource() {
      const src = { connect: noOp, start(t) { this.started = t; }, stop(t) { this.stopped = t; } }; sources.push(src); return src;
    }
  }
  window.AudioContext = AudioContext;
  const context = vm.createContext({
    window, document, Image, structuredClone, console, devicePixelRatio: 1,
    URL: { createObjectURL(file) { const url = `blob:mixer-test/${++urlId}`; urls.set(url, file); return url; }, revokeObjectURL(url) { urls.delete(url); } },
    performance: { now: () => wall },
    matchMedia: () => ({ matches: false }),
    ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() { this.cb(); } },
    fetch: async path => { fetches.push(path); return { ok: true, arrayBuffer: async () => ({ path }) }; },
    requestAnimationFrame: cb => { raf = cb; },
    setTimeout: (cb, delay) => { const id = ++timerId; timers.set(id, { cb, at: wall + delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(config, context); vm.runInContext(script, context); await flush();
  async function step(seconds = 6) {
    wall += seconds * 1000; if (clock.state === 'running') clock.time += seconds;
    for (const [id, timer] of [...timers]) if (timer.at <= wall) { timers.delete(id); timer.cb(); }
    raf?.(wall); await flush(); raf?.(wall + 1); await flush();
  }
  async function click(selector) { $(selector).dispatchEvent(new window.Event('click')); await flush(); }
  async function play(index = 0) { await click(`#scenes button:nth-child(${index+1})`); await step(); }
  return { $, click, step, play, urls, textures, captures, sources, fetches, clock, document,
    file: (selector, filename) => { $(selector).files = filename ? [{ name: filename }] : []; },
    videos: () => [...document.querySelectorAll('#pool video')]
  };
}
