const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const rootDir = path.resolve(__dirname, '..', '..');
const webDir = path.join(rootDir, 'app', 'web');
const runtimeDir = path.join(rootDir, 'runtime-data');
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Not found', filePath });
        return;
      }

      sendJson(res, 500, { error: 'Failed to read file', message: error.message });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function serveRuntimeJson(res, fileName) {
  sendFile(res, path.join(runtimeDir, fileName));
}

function serveWebAsset(res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(webDir, path.normalize(normalized));

  if (!filePath.startsWith(webDir)) {
    sendJson(res, 400, { error: 'Invalid path' });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      sendFile(res, path.join(filePath, 'index.html'));
      return;
    }

    sendFile(res, filePath);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, port, runtimeDir });
    return;
  }

  if (pathname === '/api/runtime/authority-mock') {
    serveRuntimeJson(res, 'authority-mock.json');
    return;
  }

  if (pathname === '/api/runtime/assembled-view') {
    serveRuntimeJson(res, 'assembled-view.json');
    return;
  }

  if (pathname === '/api/runtime/compatibility-report') {
    serveRuntimeJson(res, 'compatibility-report.json');
    return;
  }

  serveWebAsset(res, pathname);
});

server.listen(port, () => {
  console.log(`ARY single-machine web app listening on http://127.0.0.1:${port}`);
});