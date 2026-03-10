import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err, getOrCreateTabState } from './shared.js';

export function registerConsoleTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'console_start',
    'Start recording console logs for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.console.startRecording();
        const isRecording = state.console.isRecording() || state.network.isRecording();
        await state.banner.update({ recording: isRecording, consoleCount: state.console.getLogs().length });
        return ok({ recording: true, targetId: args.targetId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'console_stop',
    'Stop recording console logs for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.console.stopRecording();
        const isRecording = state.console.isRecording() || state.network.isRecording();
        await state.banner.update({ recording: isRecording });
        return ok({ recording: false, targetId: args.targetId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'console_get_logs',
    'Get recorded console logs for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      type: z.string().optional().describe('Filter by log type: log, debug, info, error, warning, etc.'),
      search: z.string().optional().describe('Filter by text content'),
      limit: z.number().optional().describe('Maximum number of entries to return'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const logs = state.console.getLogs({
          type: args.type,
          search: args.search,
          limit: args.limit,
        });
        return ok(logs.map((l) => ({
          type: l.type,
          text: l.text,
          timestamp: l.timestamp,
          url: l.url,
          lineNumber: l.lineNumber,
          isException: l.isException,
        })));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'console_clear',
    'Clear recorded console logs for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        state.console.clearLogs();
        return ok({ cleared: true });
      } catch (e) {
        return err(e);
      }
    }
  );
}
