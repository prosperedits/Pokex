// POKEX static server — loopback-only, GET/HEAD-only, serves this folder.
// Cache-Control: no-cache on html/css/js so edits always arrive (the stale-
// cache plague ends here); images/video/fonts cache for a day.
// Exit code 2 = port already owned by another instance (watchdog contract).

import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4173; // PORT=8080 npm start → any port
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};
const NO_CACHE = new Set(['.html', '.css', '.js', '.json']);

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); res.end(); return; }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }

    const ext = extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': NO_CACHE.has(ext) ? 'no-cache' : 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    };

    const m = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (m && st.size && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : st.size - parseInt(m[2], 10);
      let end = m[1] ? (m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1) : st.size - 1;
      if (!Number.isFinite(start) || start < 0 || start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        res.end();
        return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(file, { start, end }).pipe(res);
      return;
    }

    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  } catch {
    try { res.writeHead(500); res.end(); } catch { /* socket gone */ }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // already serving (the always-on supervisor owns this port) — that's fine.
    console.log(`POKEX is already running on http://localhost:${PORT}/  (run "PORT=8080 npm start" for a second instance)`);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`POKEX on http://localhost:${PORT}/`));
