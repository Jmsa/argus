import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
      const targetId = url.searchParams.get('targetId') ?? 'unknown';
      const html = welcomeHTML
        .replace('${targetId}', targetId)
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
