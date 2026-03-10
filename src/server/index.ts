#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserManager } from '../browser/manager.js';
import { startStaticServer } from './static.js';
import { registerAllTools } from './tools/index.js';

const browserManager = new BrowserManager({ headless: false });
const staticServer = await startStaticServer();
process.stderr.write(`[argus] Static server on http://127.0.0.1:${staticServer.port}\n`);

if (process.env['ARGUS_NO_LAUNCH'] !== '1') {
  process.stderr.write('[argus] Launching Chrome...\n');
  await browserManager.launch();
  process.stderr.write('[argus] Chrome ready.\n');

  const welcomeTargetId = await browserManager.openTab('about:blank');
  const welcomeSession = await browserManager.attachToTab(welcomeTargetId);
  await welcomeSession.send('Page.navigate', {
    url: `http://127.0.0.1:7842/?targetId=${welcomeTargetId}`,
  });
  process.stderr.write(`[argus] Welcome page open — targetId: ${welcomeTargetId}\n`);
} else {
  process.stderr.write('[argus] ARGUS_NO_LAUNCH set — skipping auto-launch. Use browser_launch or browser_connect.\n');
}

// Register MCP tools and start stdio transport
const server = new McpServer({
  name: 'argus',
  version: '1.0.0',
});

registerAllTools(server, browserManager);

const transport = new StdioServerTransport();
await server.connect(transport);

function shutdown() {
  staticServer.close();
  process.exit(0);
}

process.on('exit', () => staticServer.close());
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
process.stdin.on('close', shutdown);
