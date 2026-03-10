import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BrowserManager } from '../../browser/manager.js';
import { ok, err, getOrCreateTabState } from './shared.js';

export function registerDOMTools(server: McpServer, browserManager: BrowserManager): void {
  server.tool(
    'dom_query',
    'Query the first element matching a CSS selector and return its properties.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      selector: z.string().describe('CSS selector to query'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const info = await state.dom.query(args.selector);
        return ok(info);
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'dom_query_all',
    'Query all elements matching a CSS selector and return their properties.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      selector: z.string().describe('CSS selector to query'),
      limit: z.number().optional().describe('Maximum number of elements to return (default: 50)'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const infos = await state.dom.queryAll(args.selector, args.limit);
        return ok(infos);
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'dom_click',
    'Click the first element matching a CSS selector (scrolls into view first).',
    {
      targetId: z.string().describe('Target ID of the tab'),
      selector: z.string().describe('CSS selector of the element to click'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.dom.click(args.selector);
        return ok({ clicked: args.selector });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'dom_input_value',
    'Set the value of an input element and dispatch input/change events (works with React/Vue controlled inputs).',
    {
      targetId: z.string().describe('Target ID of the tab'),
      selector: z.string().describe('CSS selector of the input element'),
      text: z.string().describe('Text to set as the input value'),
      clear: z.boolean().optional().describe('Clear existing value before typing (default: false)'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        await state.dom.inputValue(args.selector, args.text, { clear: args.clear });
        return ok({ set: args.selector, value: args.text });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'dom_get_value',
    'Get the current value of an input element.',
    {
      targetId: z.string().describe('Target ID of the tab'),
      selector: z.string().describe('CSS selector of the input element'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const value = await state.dom.getValue(args.selector);
        return ok({ selector: args.selector, value });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    'dom_wait_for',
    'Wait for an element to appear in the DOM (polls every 100ms).',
    {
      targetId: z.string().describe('Target ID of the tab'),
      selector: z.string().describe('CSS selector to wait for'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 5000)'),
      visible: z.boolean().optional().describe('Also require the element to be visible (default: false)'),
    },
    async (args) => {
      try {
        const state = await getOrCreateTabState(browserManager, args.targetId);
        const info = await state.dom.waitFor(args.selector, {
          timeout: args.timeout,
          visible: args.visible,
        });
        return ok(info);
      } catch (e) {
        return err(e);
      }
    }
  );
}
