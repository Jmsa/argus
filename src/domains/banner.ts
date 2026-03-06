import type { CDPSession } from '../cdp/client.js';
import type { BindingCalledEvent } from '../types/cdp.js';
import type { ConsoleDomain } from './console.js';
import type { NetworkDomain } from './network.js';
import { ScreenshotDomain } from './screenshot.js';

export interface BannerData {
  recording?: boolean;
  consoleCount?: number;
  networkCount?: number;
}

// ─── Injectable banner script ─────────────────────────────────────────────────
// Self-contained IIFE. No ES module syntax, no template literals (backtick-safe).
// Communicates back to the server via window.__argusNotify (Runtime.addBinding).

export const BANNER_SCRIPT = `
(function() {
  'use strict';
  if (window.__argusBannerInstalled) return;
  window.__argusBannerInstalled = true;

  var state = { recording: false, consoleCount: 0, networkCount: 0 };

  // ── Styles ──────────────────────────────────────────────────────────────────
  // Collapsed: 6px strip + centered logo tab hanging below.
  // Expanded: 44px, JS-driven (not CSS :hover) so hovering the tab also expands.
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    // Outer: overflow visible so the tab can hang below; height transitions via JS
    '#__argus_banner{position:fixed;top:0;left:0;right:0;height:6px;',
      'z-index:2147483647;overflow:visible;box-sizing:border-box;',
      'transition:height 180ms cubic-bezier(0.4,0,0.2,1)}',
    // Inner clip: matches parent height, clips the controls row at the strip boundary
    '#__argus_clip{position:absolute;top:0;left:0;right:0;height:100%;overflow:hidden;',
      'background:#0d1117;border-top:3px solid #79c0ff;border-bottom:1px solid #30363d;',
      'box-sizing:border-box}',
    // Controls row — always 44px, revealed as the clip expands
    '#__argus_inner{height:44px;display:flex;align-items:center;padding:0 14px;gap:10px;',
      'font-family:SF Mono,Cascadia Code,Consolas,monospace;font-size:11px;',
      'color:#e6edf3;box-sizing:border-box;white-space:nowrap}',
    // Tab: hangs below the strip, fades out when panel is expanded
    '#__argus_tab{position:absolute;bottom:0;left:50%;',
      'transform:translateX(-50%) translateY(100%);',
      'background:#0d1117;border:1px solid #30363d;border-top:none;',
      'border-radius:0 0 6px 6px;padding:2px 10px 4px;',
      'font-family:SF Mono,Cascadia Code,Consolas,monospace;font-size:11px;font-weight:700;',
      'color:#79c0ff;white-space:nowrap;cursor:default;',
      'display:flex;align-items:center;gap:5px}',
    // Buttons
    '.__ab{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);',
      'color:#e6edf3;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer;',
      'font-family:inherit;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;line-height:1.4}',
    '.__ab:hover{background:rgba(255,255,255,.13)}',
    '.__ab.danger{border-color:rgba(255,123,114,.5);color:#ff7b72}',
    '.__ab.danger:hover{background:rgba(255,123,114,.12)}',
    '.__ab.active{background:rgba(255,123,114,.18);border-color:#ff7b72;color:#ff7b72}',
    '.__a_sep{width:1px;height:18px;background:#30363d;flex-shrink:0}',
    '.__a_stat{color:#8b949e;display:flex;align-items:center;gap:3px}',
    '.__a_stat b{color:#e6edf3;font-weight:600}',
    '.__a_dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
    '.__a_dot.off{background:#3fb950}',
    '.__a_dot.on{background:#ff7b72;animation:__ab_pulse 1s infinite}',
    '@keyframes __ab_pulse{0%,100%{opacity:1}50%{opacity:.35}}',
  ].join('');
  (document.head || document.documentElement).appendChild(styleEl);

  // ── Expand / collapse (JS-driven so the tab also triggers it) ────────────────
  // A debounce timer lets the mouse move freely between the banner and tab
  // without triggering a collapse between the two.
  var _collapseTimer = null;

  function expand() {
    if (_collapseTimer) { clearTimeout(_collapseTimer); _collapseTimer = null; }
    var b = document.getElementById('__argus_banner');
    if (b) b.style.height = '44px';
  }

  function collapse() {
    _collapseTimer = setTimeout(function() {
      _collapseTimer = null;
      var b = document.getElementById('__argus_banner');
      if (b) b.style.height = '';
    }, 0);
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────
  var banner;

  function ensureBanner() {
    if (!document.getElementById('__argus_banner')) {
      banner = document.createElement('div');
      banner.id = '__argus_banner';
      document.documentElement.appendChild(banner);
      render();
    } else {
      banner = document.getElementById('__argus_banner');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    var b = document.getElementById('__argus_banner');
    if (!b) return;
    var dotClass = '__a_dot ' + (state.recording ? 'on' : 'off');
    var recHtml = state.recording
      ? '<button class="__ab active" id="__ab_stop">&#9632; Stop</button>'
      : '<button class="__ab danger" id="__ab_rec">&#9679; Record</button>';

    b.innerHTML =
      '<div id="__argus_clip"><div id="__argus_inner">' + [
        '<span style="font-weight:700;color:#79c0ff;letter-spacing:-.3px;flex-shrink:0">',
          '&#9687; <span style="color:#d2a8ff">Argus</span>',
        '</span>',
        '<span class="' + dotClass + '"></span>',
        '<div class="__a_sep"></div>',
        recHtml,
        '<button class="__ab" id="__ab_shot">&#128247; Screenshot</button>',
        '<button class="__ab" id="__ab_reload">&#8635; Reload</button>',
        '<div class="__a_sep"></div>',
        '<span class="__a_stat">NET <b>' + state.networkCount + '</b></span>',
        '<span class="__a_stat">LOG <b>' + state.consoleCount + '</b></span>',
      ].join('') + '</div></div>' +
      '<div id="__argus_tab">&#9687; <span style="color:#d2a8ff">Argus</span></div>';

    wire('__ab_rec',    function() { notify('record'); });
    wire('__ab_stop',   function() { notify('stop'); });
    wire('__ab_shot',   function() { notify('screenshot'); });
    wire('__ab_reload', function() { notify('reload'); });

    // Hover expand/collapse on the strip only; tab uses click to toggle
    b.onmouseenter = expand;
    b.onmouseleave = collapse;
    var tab = document.getElementById('__argus_tab');
    if (tab) {
      tab.onclick = function() {
        var current = document.getElementById('__argus_banner');
        if (current && current.style.height === '44px') { collapse(); } else { expand(); }
      };
    }
  }

  function wire(id, fn) {
    var el = document.getElementById(id);
    if (el) el.onclick = fn;
  }

  // ── Communication ────────────────────────────────────────────────────────────
  function notify(type) {
    try {
      if (typeof window.__argusNotify === 'function') {
        window.__argusNotify(JSON.stringify({ type: type }));
      }
    } catch(e) {}
  }

  // ── External API ─────────────────────────────────────────────────────────────
  window.__argusBannerUpdate = function(data) {
    if (data.recording !== undefined) state.recording = data.recording;
    if (data.consoleCount !== undefined) state.consoleCount = data.consoleCount;
    if (data.networkCount !== undefined) state.networkCount = data.networkCount;
    render();
  };

  // ── Keep-alive: re-attach banner if the page removes it ─────────────────────
  new MutationObserver(function() {
    if (!document.getElementById('__argus_banner')) {
      ensureBanner();
    }
  }).observe(document.documentElement, { childList: true });

  ensureBanner();
})();
`;

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
