import test from 'node:test';
import assert from 'node:assert/strict';
import { ClipEvents } from '../src/events.js';

const message = (type, id, extra = {}) => ({ type, data: { clip: { clip_id: id }, ...extra } });
test('a fast generation completion is retained before the waiter exists', async () => {
  const events = new ClipEvents(); events.push(message('clip_generated', 'our-clip'));
  assert.equal((await events.wait('clip_generated', 'our-clip')).clip.clip_id, 'our-clip');
});
test('an unrelated completion does not release the current request', async () => {
  const events = new ClipEvents(); let resolved = false;
  const pending = events.wait('clip_generated', 'ours', 1000).then(() => { resolved = true; });
  events.push(message('clip_generated', 'someone-else'));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(resolved, false);
  events.push(message('clip_generated', 'ours')); await pending; assert.equal(resolved, true);
});
test('failure and explicit disconnect unblock a waiting generation', async () => {
  const events = new ClipEvents(); const pending = events.wait('clip_generated', 'ours');
  events.push(message('clip_failed', 'ours', { reason: 'Model failed' }));
  await assert.rejects(pending, /Model failed/);
  const next = events.wait('clip_finished', 'next'); events.close('Cancelled');
  await assert.rejects(next, /Cancelled/);
  await assert.rejects(events.wait('clip_generated', 'later'), /Cancelled/);
});
