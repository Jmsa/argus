import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err, getOrCreateTabState } from './shared.js';

export function registerNetworkTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'network_start_recording',
    'Start recording network requests for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.network.startRecording();
        const isRecording = state.console.isRecording() || state.network.isRecording();
        await state.banner.update({ recording: isRecording, networkCount: state.network.getRequests().length });
        return ok({ recording: true, targetId: args.targetId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_stop_recording',
    'Stop recording network requests for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.network.stopRecording();
        const isRecording = state.console.isRecording() || state.network.isRecording();
        await state.banner.update({ recording: isRecording });
        return ok({ recording: false, targetId: args.targetId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_get_requests',
    'Get recorded network requests for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      url: z.string().optional().describe('Filter by URL substring'),
      method: z.string().optional().describe('Filter by HTTP method (GET, POST, etc.)'),
      status: z.number().optional().describe('Filter by HTTP status code'),
      hasError: z.boolean().optional().describe('Filter to only show requests with errors'),
      limit: z.number().optional().describe('Maximum number of entries to return'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const requests = state.network.getRequests({
          url: args.url,
          method: args.method,
          status: args.status,
          hasError: args.hasError,
          limit: args.limit,
        });
        return ok(requests.map((r) => ({
          requestId: r.requestId,
          url: r.url,
          method: r.method,
          status: r.status,
          statusText: r.statusText,
          mimeType: r.mimeType,
          duration: r.duration,
          error: r.error,
          type: r.type,
        })));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_clear_requests',
    'Clear recorded network requests for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        state.network.clearRequests();
        return ok({ cleared: true });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_add_mock',
    'Add a network mock rule that intercepts matching requests.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      urlPattern: z.string().describe('URL pattern to match (supports * and ** glob wildcards)'),
      responseCode: z.number().describe('HTTP response code to return'),
      responseBody: z.string().optional().describe('Response body string'),
      responseHeaders: z.record(z.string()).optional().describe('Response headers as key-value pairs'),
      method: z.string().optional().describe('HTTP method to match (optional, matches all if omitted)'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const id = await state.network.addMock({
          urlPattern: args.urlPattern,
          responseCode: args.responseCode,
          responseBody: args.responseBody,
          responseHeaders: args.responseHeaders,
          method: args.method,
        });
        return ok({ mockId: id, urlPattern: args.urlPattern });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_remove_mock',
    'Remove a network mock rule by ID.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      mockId: z.string().describe('Mock rule ID to remove'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const removed = await state.network.removeMock(args.mockId);
        return ok({ removed, mockId: args.mockId });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_list_mocks',
    'List all active network mock rules for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const mocks = state.network.listMocks();
        return ok(mocks);
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'network_clear_mocks',
    'Remove all network mock rules for a tab.',
    {
      targetId: z.string().describe('Target ID of the tab'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.network.clearMocks();
        return ok({ cleared: true });
      } catch (e) {
        return err(e);
      }
    }
  );
}
