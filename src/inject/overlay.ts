// Typed TypeScript source for the Argus overlay IIFE.
// Compiled by esbuild → src/inject/dist/overlay.js (ES5, minified, IIFE format).
// This file is NOT imported by the server — only compiled by build.ts.

interface OverlayData {
  status?: 'connected' | 'recording' | 'idle';
  consoleCount?: number;
  networkCount?: number;
}

declare global {
  interface Window {
    __argusOverlayInstalled?: boolean;
    __argusUpdateOverlay?: (data: OverlayData) => void;
    __argusScreenshotRequested?: number;
  }
}

export {};

function install(): void {
  if (window.__argusOverlayInstalled) return;
  window.__argusOverlayInstalled = true;

  const panel = document.createElement('div');
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelX = 16;
  let panelY = 16;

  panel.id = '__argus_overlay';
  panel.style.cssText = [
    'position: fixed',
    'top: ' + panelY + 'px',
    'left: ' + panelX + 'px',
    'z-index: 2147483647',
    'background: rgba(20, 20, 30, 0.92)',
    'color: #e0e0e0',
    'font-family: monospace',
    'font-size: 11px',
    'padding: 8px 12px',
    'border-radius: 6px',
    'border: 1px solid rgba(255,255,255,0.15)',
    'backdrop-filter: blur(4px)',
    'cursor: move',
    'user-select: none',
    'min-width: 160px',
    'box-shadow: 0 4px 20px rgba(0,0,0,0.5)',
  ].join(';');

  panel.innerHTML = [
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">',
    '  <span id="__argus_dot" style="width:8px;height:8px;border-radius:50%;background:#4caf50;flex-shrink:0"></span>',
    '  <span style="font-weight:bold;color:#90caf9">Argus</span>',
    '</div>',
    '<div id="__argus_console" style="margin:2px 0;color:#ce93d8">&#9654; Console: <b>0</b></div>',
    '<div id="__argus_network" style="margin:2px 0;color:#80cbc4">&#9670; Network: <b>0</b></div>',
    '<button id="__argus_screenshot" style="',
    '  margin-top:6px;width:100%;background:rgba(100,130,200,0.3);border:1px solid rgba(100,130,200,0.5);',
    '  color:#90caf9;padding:3px 6px;border-radius:3px;cursor:pointer;font-size:10px;font-family:monospace',
    '">Screenshot</button>',
  ].join('');

  document.documentElement.appendChild(panel);

  // Dragging
  panel.addEventListener('mousedown', function(e: MouseEvent) {
    isDragging = true;
    dragStartX = e.clientX - panelX;
    dragStartY = e.clientY - panelY;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e: MouseEvent) {
    if (!isDragging) return;
    panelX = e.clientX - dragStartX;
    panelY = e.clientY - dragStartY;
    panel.style.left = panelX + 'px';
    panel.style.top = panelY + 'px';
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
  });

  // Screenshot button
  const btn = document.getElementById('__argus_screenshot');
  if (btn) {
    btn.addEventListener('click', function(e: Event) {
      e.stopPropagation();
      window.__argusScreenshotRequested = (window.__argusScreenshotRequested || 0) + 1;
    });
  }

  // External update API
  window.__argusUpdateOverlay = function(data: OverlayData): void {
    const dot = document.getElementById('__argus_dot');
    const consoleEl = document.getElementById('__argus_console');
    const networkEl = document.getElementById('__argus_network');

    if (dot && data.status) {
      const colors: Record<string, string> = { connected: '#4caf50', recording: '#ff9800', idle: '#9e9e9e' };
      dot.style.background = colors[data.status] || '#4caf50';
    }
    if (consoleEl && data.consoleCount !== undefined) {
      consoleEl.innerHTML = '&#9654; Console: <b>' + data.consoleCount + '</b>';
    }
    if (networkEl && data.networkCount !== undefined) {
      networkEl.innerHTML = '&#9670; Network: <b>' + data.networkCount + '</b>';
    }
  };
}

install();
