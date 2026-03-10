import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err, getOrCreateTabState } from './shared.js';

export function registerPageTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'page_evaluate',
    'Evaluate JavaScript expression in a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      expression: z.string().describe('JavaScript expression to evaluate'),
      returnByValue: z.boolean().optional().describe('Return result by value (default: true)'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const result = await state.session.send('Runtime.evaluate', {
          expression: args.expression,
          returnByValue: args.returnByValue ?? true,
          awaitPromise: true,
        });
        return ok(result);
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'page_reload',
    'Reload a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      ignoreCache: z.boolean().optional().describe('Hard reload ignoring cache (default: false)'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.session.send('Page.reload', { ignoreCache: args.ignoreCache ?? false });
        return ok({ reloaded: true });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'page_get_url',
    'Get the current URL of a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const tabs = await browserManager.listTabs();
        const tab = tabs.find((t) => t.id === args.targetId);
        if (!tab) return err(`Tab ${args.targetId} not found`);
        return ok({ url: tab.url, title: tab.title });
      } catch (e) {
        return err(e);
      }
    }
  );
}
