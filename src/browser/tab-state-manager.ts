import type { CDPSession } from '../cdp/client.js';
import { ConsoleDomain } from '../domains/console.js';
import { ScreenshotDomain } from '../domains/screenshot.js';
import { NetworkDomain } from '../domains/network.js';
import { BannerDomain } from '../domains/banner.js';
import { DOMDomain } from '../domains/dom.js';

export interface TabState {
  session: CDPSession;
  console: ConsoleDomain;
  screenshot: ScreenshotDomain;
  network: NetworkDomain;
  banner: BannerDomain;
  dom: DOMDomain;
}

export class TabStateManager {
  private states = new Map<string, TabState>();

  async getOrCreate(targetId: string, attach: () => Promise<CDPSession>): Promise<TabState> {
    const existing = this.states.get(targetId);
    if (existing) return existing;

    const session = await attach();
    const consoleDomain = new ConsoleDomain(session);
    const screenshotDomain = new ScreenshotDomain(session);
    const networkDomain = new NetworkDomain(session);
    const banner = new BannerDomain(session, consoleDomain, networkDomain, screenshotDomain);
    const dom = new DOMDomain(session);

    const state: TabState = {
      session,
      console: consoleDomain,
      screenshot: screenshotDomain,
      network: networkDomain,
      banner,
      dom,
    };
    this.states.set(targetId, state);

    await banner.install();

    return state;
  }

  delete(targetId: string): void {
    this.states.delete(targetId);
  }

  clear(): void {
    this.states.clear();
  }

  get size(): number {
    return this.states.size;
  }
}
