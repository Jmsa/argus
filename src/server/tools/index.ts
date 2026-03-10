import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { registerBrowserTools } from './browser.js';
import { registerTabTools } from './tabs.js';
import { registerConsoleTools } from './console.js';
import { registerNetworkTools } from './network.js';
import { registerPageTools } from './page.js';
import { registerBannerTools } from './banner.js';
import { registerDOMTools } from './dom.js';

export function registerAllTools(server: McpServer, browserManager: BrowserManager): void {
  registerBrowserTools(server, browserManager);
  registerTabTools(server, browserManager);
  registerConsoleTools(server, browserManager);
  registerNetworkTools(server, browserManager);
  registerPageTools(server, browserManager);
  registerBannerTools(server, browserManager);
  registerDOMTools(server, browserManager);
}
