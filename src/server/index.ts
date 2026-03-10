#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserManager } from '../browser/manager.js';
import { injectWelcomePage } from '../domains/welcome.js';
import { registerAllTools } from './tools/index.js';

const browserManager = new BrowserManager({ headless: false });

if (process.env['ARGUS_NO_LAUNCH'] !== '1') {
  process.stderr.write('[argus] Launching Chrome...\n');
  await browserManager.launch();
  process.stderr.write('[argus] Chrome ready.\n');

  const welcomeTargetId = await browserManager.openTab('about:blank');
  const welcomeSession = await browserManager.attachToTab(welcomeTargetId);
  await injectWelcomePage(welcomeSession, welcomeTargetId);
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
