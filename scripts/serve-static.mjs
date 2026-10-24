import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('out');
const port = Number(process.env.PORT || 4173);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
http
  .createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
      if (basePath) {
        if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
          response.writeHead(404);
          response.end();
          return;
        }
        pathname = pathname.slice(basePath.length) || '/';
      }
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      let info = await stat(file);
      if (info.isDirectory()) {
        file = path.join(file, 'index.html');
        info = await stat(file);
      }
      if (!info.isFile()) throw new Error('Not a file');
      const headers = {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      };
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const start = Number(range[1]),
          end = Math.min(range[2] ? Number(range[2]) : info.size - 1, info.size - 1);
        if (start > end) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
          response.end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${info.size}`,
          'Content-Length': end - start + 1,
        });
        if (request.method === 'HEAD') response.end();
        else createReadStream(file, { start, end }).pipe(response);
      } else {
        response.writeHead(200, { ...headers, 'Content-Length': info.size });
        if (request.method === 'HEAD') response.end();
        else createReadStream(file).pipe(response);
      }
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}${basePath}/`));
