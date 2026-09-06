'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT) || 4174;
http.createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  const filename = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(filename, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' })[path.extname(filename)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`CreativeBlocks: http://127.0.0.1:${port}`));
