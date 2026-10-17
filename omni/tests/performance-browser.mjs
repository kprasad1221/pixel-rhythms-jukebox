import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const artifacts = process.env.JUKEBOX_ARTIFACTS || mkdtempSync(join(tmpdir(), 'jukebox-performance-'));
const server = createApp({ apiKey: '' });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const errors = [], tokens = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/token')) tokens.push(request.url()); if (request.url().startsWith('https://')) external.push(request.url()); });
  await page.route('https://**/*', route => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => document.querySelector('#activity-log').textContent.includes('App ready'));
  assert.deepEqual(await page.locator('.pad-name').allTextContents(), Array.from({ length: 10 }, (_, i) => String(i + 1)));
  await page.locator('#record').click();
  assert.match(await page.locator('#record-status').innerText(), /Play a pad first/);
  assert.equal(await page.locator('#save-performance').isDisabled(), true);
  // Make known-colored audiovisual loops, rather than depending on private media.
  const clips = await page.evaluate(async () => {
    const clips = [];
    for (const [color, frequency] of [['#e63232', 440], ['#1e5be6', 880]]) {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      let tick = 0;
      const draw = () => { ctx.fillStyle = color; ctx.fillRect(0, 0, 320, 180); ctx.fillStyle = 'white'; ctx.fillRect((tick++ * 5) % 300, 10, 20, 20); };
      draw();
      const audio = new AudioContext(); await audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain(), destination = audio.createMediaStreamDestination();
      oscillator.frequency.value = frequency; gain.gain.value = .2; oscillator.connect(gain); gain.connect(destination);
      const stream = canvas.captureStream(24); stream.addTrack(destination.stream.getAudioTracks()[0]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' }), chunks = [];
      recorder.ondataavailable = event => chunks.push(event.data);
      const stopped = new Promise(resolve => recorder.onstop = resolve);
      const timer = setInterval(draw, 1000 / 24); oscillator.start(); recorder.start();
      await new Promise(resolve => setTimeout(resolve, 1200)); recorder.stop(); await stopped;
      clearInterval(timer); oscillator.stop(); stream.getTracks().forEach(track => track.stop()); await audio.close();
      clips.push(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
    }
    return clips;
  });
  for (let i = 0; i < 2; i++) {
    await page.locator('#edit-pad').selectOption(String(i));
    await page.locator('#pad-clip').setInputFiles({ name: `loop-${i}.webm`, mimeType: 'video/webm', buffer: Buffer.from(clips[i]) });
    await page.waitForFunction(() => document.querySelector('#editor-status').textContent.startsWith('Saved'));
  }
  await page.locator('#editor').evaluate(element => element.open = false);
  await page.locator('.pad').first().click();
  await page.waitForFunction(() => document.querySelector('.pad').getAttribute('aria-pressed') === 'true');
  await page.locator('#record').click();
  await page.waitForFunction(() => document.querySelector('#record-status').dataset.state === 'recording');
  await page.waitForTimeout(900);
  await page.locator('#fade-seconds').selectOption('1.5');
  await page.locator('.pad').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('.pad')[1].getAttribute('aria-pressed') === 'true');
  await page.waitForTimeout(500);
  await page.locator('#volume').fill('0.25');
  await page.waitForTimeout(650);
  await page.locator('#pause').click();
  await page.waitForTimeout(450);
  await page.locator('#pause').click();
  await page.waitForTimeout(500);
  await page.locator('#record').click();
  await page.waitForFunction(() => document.querySelector('#record-status').dataset.state === 'ready');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save-performance').click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /^pixel-rhythms-performance-.*\.webm$/);
  await download.saveAs(join(artifacts, 'performance.webm'));
  const bytes = readFileSync(join(artifacts, 'performance.webm'));
  assert.ok(bytes.length > 10000);
  // Seek and sample the saved file: red, a visible dissolve, then blue.
  const samples = await page.evaluate(async data => {
    const video = document.createElement('video'); video.muted = true; video.playsInline = true;
    video.src = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'video/webm' })); document.body.append(video);
    await video.play(); video.pause();
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d'); const results = [];
    for (const time of [.4, 1.6, 2.8]) {
      await new Promise(resolve => { video.onseeked = resolve; video.currentTime = time; });
      ctx.drawImage(video, 0, 0); results.push(Array.from(ctx.getImageData(50, 400, 1, 1).data));
    }
    const result = { width: video.videoWidth, height: video.videoHeight, samples: results };
    video.remove(); URL.revokeObjectURL(video.src); return result;
  }, Array.from(bytes));
  assert.equal(samples.width, 1280); assert.equal(samples.height, 720);
  assert.ok(samples.samples[0][0] > 190 && samples.samples[0][2] < 80, JSON.stringify(samples));
  assert.ok(samples.samples[1][0] > 60 && samples.samples[1][2] > 70, JSON.stringify(samples));
  assert.ok(samples.samples[2][2] > 190 && samples.samples[2][0] < 80, JSON.stringify(samples));
  const layouts = [];
  for (const [width, height] of [[1366,768],[1920,1080],[1024,768],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const selectors = ['.stage', '#buttons', '#record', '#save-performance', '#pause', '#volume', '#fade-seconds'];
      return { overflow: document.documentElement.scrollWidth > innerWidth, controls: selectors.map(selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { selector, top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height };
      }) };
    });
    assert.equal(layout.overflow, false, JSON.stringify({ width, height, layout }));
    for (const control of layout.controls) { assert.ok(control.top >= 0 && control.bottom <= height && control.left >= 0 && control.right <= width && control.width > 0 && control.height > 0, JSON.stringify({ width, height, control })); }
    layouts.push({ width, height, fits: true });
    await page.screenshot({ path: join(artifacts, `layout-${width}x${height}.png`) });
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#activity-log').textContent.includes('App ready'));
  await page.locator('#editor').evaluate(element => element.open = true);
  assert.equal(await page.locator('#clip-name').innerText(), 'loop-0.webm');
  assert.deepEqual(errors, []); assert.equal(tokens.length, 0); assert.equal(external.length, 0);
  console.log(JSON.stringify({ artifacts, downloadBytes:bytes.length, ...samples, layouts, assignmentsRetained:true, tokens:tokens.length, external:external.length, errors }));
} finally {
  await browser?.close(); server.close(); server.closeAllConnections();
}
