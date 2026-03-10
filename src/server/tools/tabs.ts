import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err, getOrCreateTabState } from './shared.js';

export function registerTabTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'tab_list',
    'List all open browser tabs.',
    {},
    async () => {
      try {
        const tabs = await browserManager.listTabs();
        return ok(tabs.map((t) => ({ id: t.id, title: t.title, url: t.url })));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'tab_open',
    'Open a new browser tab and navigate to a URL.',
    {
      url: z.string().optional().describe('URL to open (default: about:blank)'),
    },
    async (args) => {
      try {
        const targetId = await browserManager.openTab(args.url);
        await getOrCreateTabState(browserManager, targetId);
        return ok({ targetId, url: args.url ?? 'about:blank' });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'tab_navigate',
    'Navigate a tab to a URL.',
    {
      targetId: z.string().describe('Target ID of the tab to navigate'),
      url: z.string().describe('URL to navigate to'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const result = await state.session.send('Page.navigate', { url: args.url });
        return ok({ targetId: args.targetId, url: args.url, result });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'tab_close',
    'Close a browser tab.',
    {
      targetId: z.string().describe('Target ID of the tab to close'),
    },
    async (args) => {
      try {
        await browserManager.closeTab(args.targetId);
        return ok({ closed: args.targetId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'tab_screenshot',
    'Take a screenshot of a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      fullPage: z.boolean().optional().describe('Capture full page (default: false)'),
      format: z.enum(['png', 'jpeg', 'webp']).optional().describe('Image format (default: png)'),
      quality: z.number().min(0).max(100).optional().describe('JPEG/WebP quality 0-100'),
      clip: z.object({
        x: z.number(), y: z.number(), width: z.number(), height: z.number(),
      }).optional().describe('Clip region'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const screenshot = await state.screenshot.capture({
          fullPage: args.fullPage,
          format: args.format,
          quality: args.quality,
          clip: args.clip,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ width: screenshot.width, height: screenshot.height, mimeType: screenshot.mimeType }),
            },
            {
              type: 'image' as const,
              data: screenshot.data,
              mimeType: screenshot.mimeType,
            },
          ],
        };
      } catch (e) {
        return err(e);
      }
    }
  );
}
