import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err } from './shared.js';

export function registerBrowserTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'browser_launch',
    'Launch a new Chrome browser instance with remote debugging enabled.',
    {},
    async () => {
      try {
        await browserManager.launch();
        return ok({ status: 'launched', message: 'Chrome launched successfully' });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'browser_connect',
    'Connect to an already-running Chrome instance via WebSocket debugger URL.',
    {
      wsUrl: z.string().optional().describe('WebSocket debugger URL (e.g. ws://localhost:9222/json/version). If omitted, connects to localhost:9222'),
    },
    async (args) => {
      try {
        await browserManager.connect(args.wsUrl);
        return ok({ status: 'connected' });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'browser_disconnect',
    'Disconnect from Chrome (leaves browser running).',
    {},
    async () => {
      try {
        browserManager.disconnect();
        return ok({ status: 'disconnected' });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'browser_status',
    'Get the current connection status of the browser.',
    {},
    async () => {
      try {
        return ok({
          connected: browserManager.isConnected(),
          launched: browserManager.isLaunched(),
          activeTabs: browserManager.tabStates.size,
        });
      } catch (e) {
        return err(e);
      }
    }
  );
}
