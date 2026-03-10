import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err, getOrCreateTabState } from './shared.js';

export function registerBannerTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'banner_get_screenshots',
    'Retrieve screenshots captured via the Argus banner Screenshot button. Clears the queue after returning.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const shots = state.banner.getScreenshots();
        if (shots.length === 0) return ok({ count: 0, screenshots: [] });
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ count: shots.length }) },
            ...shots.map((s) => ({ type: 'image' as const, data: s.data, mimeType: s.mimeType })),
          ],
        };
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'banner_update',
    'Push state updates to the Argus banner on a tab (recording indicator, counts).',
    {
      targetId: z.string().describe('Target ID of the tab'),
      recording: z.boolean().optional().describe('Whether recording is active'),
      consoleCount: z.number().optional().describe('Console log count to display'),
      networkCount: z.number().optional().describe('Network request count to display'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.banner.update({
          recording: args.recording,
          consoleCount: args.consoleCount,
          networkCount: args.networkCount,
        });
        return ok({ updated: true });
      } catch (e) {
        return err(e);
      }
    }
  );
}
