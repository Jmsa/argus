import { BrowserManager } from '../../browser/manager.js';
import { ArgusError } from '../../types/errors.js';
export type { TabState } from '../../browser/tab-state-manager.js';
export { ArgusError } from '../../types/errors.js';

export async function getOrCreateTabState(browserManager: BrowserManager, targetId: string) {
  return browserManager.tabStates.getOrCreate(targetId, () => browserManager.attachToTab(targetId));
}

export function ok(content: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }],
  };
}

export function err(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const isArgus = error instanceof ArgusError;
  return {
    content: [{ type: 'text', text: JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      code: isArgus ? error.code : 'CDP_ERROR',
      ...(isArgus && error.detail !== undefined ? { detail: error.detail } : {}),
    }) }],
    isError: true,
  };
}
