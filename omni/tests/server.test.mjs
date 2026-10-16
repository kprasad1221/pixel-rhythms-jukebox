import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

async function withServer(options, check) {
  const server = createApp(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => {
    const headers = { ...options.headers };
    if (headers.Origin === 'http://127.0.0.1:8093') headers.Origin = url;
    return fetch(url + path, { ...options, headers });
  };
  try { await check(request); } finally { server.close(); server.closeAllConnections(); }
}
const tokenRequest = { method:'POST', headers:{ Origin:'http://127.0.0.1:8093', 'Content-Type':'application/json' }, body:'{}' };
test('missing key keeps local playback available without contacting Reactor', () => withServer({ apiKey: '', tokenFetch: () => { throw new Error('Should not be called'); } }, async request => {
  assert.deepEqual(await request('/api/config').then(r=>r.json()), {configured:false});
  assert.equal((await request('/api/token', tokenRequest)).status, 503);
  assert.equal((await request('/')).status, 200);
}));
test('only a local JSON request can mint a model-scoped token; no private key is returned', () => withServer({ apiKey:'fake-test-key', tokenFetch:async (url, options) => {
  assert.equal(url, 'https://api.reactor.inc/tokens');
  assert.equal(options.headers['Reactor-API-Key'], 'fake-test-key');
  const scope = JSON.parse(options.body).authorization_details[0];
  assert.deepEqual(scope.resources.models.match, ['reactor/fast-h3-omni']);
  assert.equal(scope.constraints.max_sessions, 1);
  assert.equal(scope.constraints.max_session_duration_seconds, 30);
  return Response.json({jwt:'fake-test-token', other:'not-returned'});
} }, async request => {
  assert.equal((await request('/api/token', { ...tokenRequest, headers:{ ...tokenRequest.headers, Origin:'https://unrelated.example' } })).status, 403);
  assert.equal((await request('/api/token', {method:'POST'})).status, 403);
  assert.equal((await request('/api/token')).status, 404);
  assert.equal((await request('/.env.local')).status, 404);
  assert.equal((await request('/server.mjs')).status, 404);
  assert.deepEqual(await request('/api/token', tokenRequest).then(r=>r.json()), {jwt:'fake-test-token'});
}));
test('the built SDK and companion WebAssembly are both served', () => withServer({apiKey:''}, async request => {
  const js = await request('/app.js'); assert.equal(js.status,200);
  const wasm = await request('/reactor_wasm_bg.wasm'); assert.equal(wasm.status,200);
  assert.equal(wasm.headers.get('Content-Type'),'application/wasm');
  assert.ok((await wasm.arrayBuffer()).byteLength > 10000);
}));
