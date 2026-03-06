import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../browser/manager.js';
import type { CDPSession } from '../cdp/client.js';
import { ConsoleDomain } from '../domains/console.js';
import { ScreenshotDomain } from '../domains/screenshot.js';
import { NetworkDomain } from '../domains/network.js';
import { BannerDomain } from '../domains/banner.js';

interface TabState {
  session: CDPSession;
  console: ConsoleDomain;
  screenshot: ScreenshotDomain;
  network: NetworkDomain;
  banner: BannerDomain;
}

const tabStates = new Map<string, TabState>();

async function getOrCreateTabState(browserManager: BrowserManager, targetId: string): Promise<TabState> {
  const existing = tabStates.get(targetId);
  if (existing) return existing;

  const session = await browserManager.attachToTab(targetId);
  const consoleDomain = new ConsoleDomain(session);
  const screenshotDomain = new ScreenshotDomain(session);
  const networkDomain = new NetworkDomain(session);
  const banner = new BannerDomain(session, consoleDomain, networkDomain, screenshotDomain);

  const state: TabState = {
    session,
    console: consoleDomain,
    screenshot: screenshotDomain,
    network: networkDomain,
    banner,
  };
  tabStates.set(targetId, state);

  // Install the banner into this tab automatically
  await banner.install();

  return state;
}

function ok(content: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }],
  };
}

function err(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerAllTools(server: McpServer, browserManager: BrowserManager): void {

  // ─── Browser tools ──────────────────────────────────────────────

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
        tabStates.clear();
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
          activeTabs: tabStates.size,
        });
      } catch (e) {
        return err(e);
      }
    }
  );

  // ─── Tab tools ──────────────────────────────────────────────────

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
        tabStates.delete(args.targetId);
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

  // ─── Console tools ──────────────────────────────────────────────

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

  // ─── Network recording tools ────────────────────────────────────

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

  // ─── Network mock tools ─────────────────────────────────────────

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

  // ─── Page tools ─────────────────────────────────────────────────

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

  // ─── Banner tools ────────────────────────────────────────────────

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
