import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readPrefs, writePrefs } from './prefs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const welcomeHTML = readFileSync(join(__dirname, '..', 'domains', 'welcome.html'), 'utf-8');
const readmeContent = readFileSync(join(__dirname, '..', '..', 'README.md'), 'utf-8');

export interface StaticServer {
  port: number;
  close(): void;
}

export function startStaticServer(): Promise<StaticServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      // GET /api/prefs
      if (url.pathname === '/api/prefs' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readPrefs()));
        return;
      }

      // PATCH /api/prefs
      if (url.pathname === '/api/prefs' && req.method === 'PATCH') {
        let body = '';
        req.on('error', () => {
          res.writeHead(400);
          res.end();
        });
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const updated = writePrefs(JSON.parse(body));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(updated));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      // Welcome page
      const targetId = url.searchParams.get('targetId') ?? 'unknown';
      const firstRun = url.searchParams.get('firstRun') === '1';
      const html = welcomeHTML
        .replace('${targetId}', targetId)
        .replace('${firstRun}', String(firstRun))
        .replace('${readmeContent}', JSON.stringify(readmeContent));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.listen(7842, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ port: addr.port, close: () => server.close() });
    });

    server.on('error', reject);
  });
}
