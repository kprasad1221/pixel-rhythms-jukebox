import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.PORT || 8093);
const origin = `http://127.0.0.1:${port}`;
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/reactor_wasm_bg.wasm', ['public/reactor_wasm_bg.wasm', 'application/wasm']],
]);

export function createApp({ apiKey = process.env.REACTOR_API_KEY, tokenFetch = fetch } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const json = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const localPort = req.socket.localPort;
    const allowedOrigins = [`http://127.0.0.1:${localPort}`, `http://localhost:${localPort}`];
    if (![`127.0.0.1:${localPort}`, `localhost:${localPort}`].includes(req.headers.host)) {
      return json(403, { error: 'Use the local address printed in your terminal.' });
    }
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
      return json(403, { error: 'Only this local app may make requests.' });
    }
    const path = new URL(req.url, origin).pathname;
    if (path === '/api/config' && req.method === 'GET') return json(200, { configured: Boolean(apiKey) });
    if (path === '/api/token' && req.method === 'POST') {
      if (req.headers['content-type'] !== 'application/json' || !req.headers.origin) return json(403, { error: 'Open the local app to connect.' });
      if (!apiKey) return json(503, { error: 'Add REACTOR_API_KEY to .env.local, then restart. Loop playback works without it.' });
      try {
        const upstream = await tokenFetch('https://api.reactor.inc/tokens', {
          method: 'POST', signal: AbortSignal.timeout(20000),
          headers: { 'Content-Type': 'application/json', 'Reactor-API-Key': apiKey },
          body: JSON.stringify({ expires_after: 3600, authorization_details: [{
            type: 'session', resources: { models: { match: ['reactor/fast-h3-omni'] } },
            constraints: { max_sessions: 1, max_session_duration_seconds: 30 },
          }] }),
        });
        if (!upstream.ok) return json(502, { error: `Reactor token request returned ${upstream.status}.` });
        const body = await upstream.json();
        if (typeof body.jwt !== 'string') return json(502, { error: 'Reactor did not return a session token.' });
        return json(200, { jwt: body.jwt });
      } catch {
        return json(502, { error: 'Could not reach Reactor. Check your connection and try again.' });
      }
    }
    if (req.method !== 'GET' || !files.has(path)) return json(404, { error: 'Not found' });
    try {
      const [name, type] = files.get(path);
      const data = await readFile(join(root, name));
      res.writeHead(200, { 'Content-Type': type }); res.end(data);
    } catch { json(500, { error: 'Run npm run build before starting the server.' }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createApp();
  server.listen(port, '127.0.0.1', () => console.log(`Pixel Rhythms Omni: ${origin}\nStart with Play loops. End Reactor in the app before Ctrl+C.`));
  process.on('SIGINT', () => { server.close(); server.closeAllConnections(); });
}
