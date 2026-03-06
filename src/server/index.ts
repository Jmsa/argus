#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserManager } from '../browser/manager.js';
import { injectWelcomePage } from '../domains/ui.js';
import { registerAllTools } from './tools.js';

const browserManager = new BrowserManager({ headless: false });

// Auto-launch Chrome and inject the welcome page
process.stderr.write('[argus] Launching Chrome...\n');
await browserManager.launch();
process.stderr.write('[argus] Chrome ready.\n');

const welcomeTargetId = await browserManager.openTab('about:blank');
const welcomeSession = await browserManager.attachToTab(welcomeTargetId);
await injectWelcomePage(welcomeSession, welcomeTargetId);
process.stderr.write(`[argus] Welcome page open — targetId: ${welcomeTargetId}\n`);

// Register MCP tools and start stdio transport
const server = new McpServer({
  name: 'argus',
  version: '1.0.0',
});

registerAllTools(server, browserManager);

const transport = new StdioServerTransport();
await server.connect(transport);
