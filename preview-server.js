// Local preview for the static site. Run with: node preview-server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

http.createServer((request, response) => {
  let target;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    target = path.resolve(root, `.${pathname}`);
    if (target === root) target = path.join(root, 'index.html');
    if (!target.startsWith(`${root}${path.sep}`) || !mime[path.extname(target).toLowerCase()]) {
      response.writeHead(403).end('Forbidden');
      return;
    }
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  response.setHeader('Content-Type', mime[path.extname(target).toLowerCase()]);
  response.setHeader('Cache-Control', 'no-store');
  const stream = fs.createReadStream(target);
  stream.on('error', () => response.writeHead(404).end('Not found'));
  stream.pipe(response);
}).listen(8123, '127.0.0.1');
