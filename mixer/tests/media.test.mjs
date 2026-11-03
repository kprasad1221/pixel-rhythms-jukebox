import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './media-harness.mjs';

test('all six configured scenes can transition and release the previous scene', async () => {
  const a = await harness();
  for (const [i, count] of [2,2,1,2,3,2].entries()) {
    await a.play(i);
    assert.equal(a.videos().length, count);
    assert.ok(a.videos().every(v => !v.paused));
    assert.equal(a.$(`#scenes button:nth-child(${i+1})`).getAttribute('aria-pressed'), 'true');
  }
});
test('light changes wait for the clock and are remembered across scenes', async () => {
  const a = await harness(); await a.play();
  await a.click('#lights button:nth-child(2)');
  assert.equal(a.$('#lights button:nth-child(2)').getAttribute('aria-pressed'), 'false');
  await a.step(3);
  assert.equal(a.$('#lights button:nth-child(2)').getAttribute('aria-pressed'), 'true');
  await a.play(1); await a.play(0);
  assert.equal(a.$('#lights button:nth-child(2)').getAttribute('aria-pressed'), 'true');
});
test('replacement video uses its own first frame and leaves scene music alone', async () => {
  const a = await harness(); await a.play();
  const audioFetches = a.fetches.length;
  a.file('#media-video', 'higher-quality.mp4'); await a.click('#media-apply');
  assert.equal(a.$('#media-fields').disabled, true);
  await a.step();
  assert.equal(a.urls.size, 1); assert.equal(a.videos().length, 2);
  assert.match(a.$('#lights button .pad-name').textContent, /higher-quality/);
  assert.ok(a.captures.some(src => src.startsWith('blob:')));
  assert.equal(a.fetches.length, audioFetches);
  assert.equal(a.$('#media-reset').disabled, false);
});
test('replacement of video, reference and music persists across scenes, then resets', async () => {
  const a = await harness(); await a.play(); const initialTextures = a.textures.size;
  a.file('#media-video','new.mp4'); a.file('#media-ref','new.jpg'); a.file('#media-music','new.wav');
  await a.click('#media-apply'); await a.step();
  assert.equal(a.urls.size, 3); assert.equal(a.textures.size, initialTextures);
  await a.play(1); await a.play(0);
  assert.match(a.videos()[0].src, /^blob:/);
  await a.click('#media-reset'); await a.step();
  assert.equal(a.urls.size, 0); assert.equal(a.textures.size, initialTextures);
  assert.equal(a.videos()[0].src, 'media/clips/basin_amber_a.mp4');
  assert.equal(a.$('#media-reset').disabled, true);
});
for (const [input, file] of [['#media-video','bad-video.mp4'],['#media-ref','bad-reference.jpg'],['#media-music','bad-music.wav']]) {
  test(`failed ${file} keeps the previous scene and releases temporary resources`, async () => {
    const a = await harness(); await a.play(); const before = a.textures.size, original = a.videos();
    a.file(input, file); await a.click('#media-apply'); await a.step();
    assert.match(a.$('#media-status').textContent, /Change not applied/);
    assert.equal(a.videos().length, original.length); assert.equal(a.videos()[0], original[0]);
    assert.equal(a.textures.size, before); assert.equal(a.urls.size, 0);
    assert.equal(a.$('#media-fields').disabled, false);
    assert.ok(a.videos().every(v => !v.paused));
  });
}
test('pause freezes playback and asks for resume before applying a replacement', async () => {
  const a = await harness(); await a.play(); await a.click('#pause'); const t = a.clock.time;
  a.file('#media-video','new.mp4'); await a.click('#media-apply'); await a.step();
  assert.equal(a.clock.time,t); assert.ok(a.videos().every(v=>v.paused));
  assert.match(a.$('#media-status').textContent,/Press Play/); assert.equal(a.urls.size,0);
  await a.click('#pause'); await a.click('#media-apply'); await a.step(); assert.equal(a.urls.size,1);
});
test('a second scene click during media loading does not race the first', async () => {
  const a = await harness();
  const first = a.click('#scenes button:nth-child(1)'), second = a.click('#scenes button:nth-child(2)');
  await Promise.all([first,second]); await a.step();
  assert.match(a.$('#scene-name').textContent,/Amber/); assert.equal(a.videos().length,2);
});
test('missing WebGL cannot start scene playback', async () => {
  const a = await harness({noGL:true}); await a.play();
  assert.match(a.$('#status').textContent,/WebGL/); assert.equal(a.videos().length,0);
});
