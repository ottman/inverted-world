const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const { createServer } = require('node:http');
const { extname, join, normalize, resolve } = require('node:path');

const root = resolve(process.env.STATIC_DIR || 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

async function fileFor(requestUrl = '/') {
  const pathname = decodeURIComponent(requestUrl.split('?')[0] || '/');
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const direct = join(root, clean);

  try {
    const directStat = await stat(direct);
    if (directStat.isFile()) return direct;
    if (directStat.isDirectory()) {
      const index = join(direct, 'index.html');
      await stat(index);
      return index;
    }
  } catch {}

  const html = join(root, `${clean}.html`);
  try {
    await stat(html);
    return html;
  } catch {}

  return join(root, 'index.html');
}

const server = createServer(async (request, response) => {
  if (request.url === '/ready' || request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  try {
    const path = await fileFor(request.url);
    const extension = extname(path);
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control':
        extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    createReadStream(path).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Inverted World serving ${root} on http://${host}:${port}`);
});
