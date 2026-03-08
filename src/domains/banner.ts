import type { CDPSession } from '../cdp/client.js';
import type { BindingCalledEvent } from '../types/cdp.js';
import type { ConsoleDomain } from './console.js';
import type { NetworkDomain } from './network.js';
import { ScreenshotDomain } from './screenshot.js';
import { BANNER_SCRIPT } from '../inject/loader.js';

export { BANNER_SCRIPT };

export interface BannerData {
  recording?: boolean;
  consoleCount?: number;
  networkCount?: number;
}

// ─── BannerDomain ─────────────────────────────────────────────────────────────

export class BannerDomain {
  private installed = false;
  private screenshots: Array<{ data: string; mimeType: string; width: number; height: number; timestamp: number }> = [];

  constructor(
    private readonly session: CDPSession,
    private readonly consoleDomain: ConsoleDomain,
    private readonly networkDomain: NetworkDomain,
    private readonly screenshotDomain: ScreenshotDomain,
  ) {}

  async install(): Promise<void> {
    if (this.installed) return;
    this.installed = true;

    // Runtime must be enabled to receive bindingCalled events
    await this.session.send('Runtime.enable');

    // Register the binding — makes window.__argusNotify available in the page.
    // Survives navigations; only needs to be called once per session.
    await this.session.send('Runtime.addBinding', { name: '__argusNotify' });

    this.session.on('Runtime.bindingCalled', (event: BindingCalledEvent) => {
      if (event.name !== '__argusNotify') return;
      let action: { type: string };
      try { action = JSON.parse(event.payload) as { type: string }; } catch { return; }
      this.handleAction(action.type).catch(() => {});
    });

    await this.session.send('Page.enable');

    // Re-inject banner after every page load (DOM is guaranteed ready at this point).
    // addScriptToEvaluateOnNewDocument fires too early (before <html> may exist), so
    // we rely on loadEventFired as the reliable injection point instead.
    this.session.on('Page.loadEventFired', () => {
      this.session.send('Runtime.evaluate', { expression: BANNER_SCRIPT, silent: true }).catch(() => {});
    });

    // Inject into the current page if it's already loaded
    await this.session.send('Runtime.evaluate', { expression: BANNER_SCRIPT, silent: true });
  }

  private async handleAction(type: string): Promise<void> {
    switch (type) {
      case 'record':
        await this.consoleDomain.startRecording();
        await this.networkDomain.startRecording();
        await this.update({ recording: true });
        break;

      case 'stop':
        await this.consoleDomain.stopRecording();
        await this.networkDomain.stopRecording();
        await this.update({ recording: false });
        break;

      case 'screenshot': {
        const shot = await this.screenshotDomain.capture({ format: 'png' });
        this.screenshots.push({ ...shot, timestamp: Date.now() });
        break;
      }

      case 'reload':
        await this.session.send('Page.reload', { ignoreCache: false });
        break;
    }
  }

  async update(data: BannerData): Promise<void> {
    const json = JSON.stringify(data);
    await this.session.send('Runtime.evaluate', {
      expression: `if(typeof window.__argusBannerUpdate==='function')window.__argusBannerUpdate(${json});`,
      silent: true,
    });
  }

  getScreenshots() {
    const shots = [...this.screenshots];
    this.screenshots = [];
    return shots;
  }
}
