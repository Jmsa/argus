import type { CDPSession } from '../cdp/client.js';

function buildWelcomeHTML(targetId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Argus — Ready</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d1117; --bg2: #161b22; --bg3: #1c2128;
    --border: #30363d; --text: #e6edf3; --muted: #8b949e;
    --green: #3fb950; --blue: #79c0ff; --purple: #d2a8ff;
    --orange: #ffa657; --teal: #56d364; --red: #ff7b72;
    --pink: #f778ba;
    --font: 'SF Mono', 'Cascadia Code', 'Consolas', 'Fira Code', monospace;
  }
  body {
    background: var(--bg); color: var(--text);
    font-family: var(--font); font-size: 13px;
    min-height: 100vh; padding: 32px 24px 64px;
    line-height: 1.6;
  }
  header {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 8px;
  }
  .logo {
    font-size: 22px; font-weight: 700; color: var(--blue);
    letter-spacing: -0.5px;
  }
  .logo span { color: var(--purple); }
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(63,185,80,0.12); border: 1px solid rgba(63,185,80,0.3);
    color: var(--green); border-radius: 20px;
    padding: 3px 12px; font-size: 11px; font-weight: 600;
  }
  .badge::before {
    content: ''; width: 7px; height: 7px; border-radius: 50%;
    background: var(--green);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .subtitle {
    color: var(--muted); font-size: 12px; margin-bottom: 28px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .target-id {
    display: inline-block;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 4px; padding: 2px 8px;
    color: var(--orange); font-family: var(--font);
    font-size: 11px;
  }
  .section-title {
    font-size: 10px; font-weight: 700; letter-spacing: 1.2px;
    text-transform: uppercase; color: var(--muted);
    margin: 32px 0 12px;
  }
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }
  .group {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px;
  }
  .group-header {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 12px;
  }
  .group-icon { font-size: 14px; }
  .group-name {
    font-size: 12px; font-weight: 700; color: var(--text);
    text-transform: uppercase; letter-spacing: 0.8px;
  }
  .tool {
    display: flex; flex-direction: column; gap: 2px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .tool:last-child { border-bottom: none; padding-bottom: 0; }
  .tool-name {
    color: var(--blue); font-weight: 600; font-size: 12px;
  }
  .tool-desc {
    color: var(--muted); font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .footer {
    margin-top: 40px;
    color: var(--muted); font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    border-top: 1px solid var(--border); padding-top: 20px;
  }
  .footer code { color: var(--orange); font-family: var(--font); font-size: 10px; }
  .dismiss {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(121,192,255,0.1); border: 1px solid rgba(121,192,255,0.3);
    color: var(--blue); border-radius: 6px;
    padding: 6px 16px; font-family: var(--font); font-size: 11px;
    cursor: pointer; margin-top: 16px; transition: background 0.15s;
  }
  .dismiss:hover { background: rgba(121,192,255,0.2); }
</style>
</head>
<body>
<header>
  <div class="logo">&#9687; <span>Argus</span></div>
  <div class="badge">Connected</div>
</header>
<p class="subtitle">
  Browser debugging via MCP &mdash; remote debugging active on this tab
  &nbsp;<span class="target-id">${targetId}</span>
</p>

<div class="section-title">Available Tools</div>
<div class="groups">

  <div class="group">
    <div class="group-header">
      <span class="group-icon">&#127760;</span>
      <span class="group-name">Browser</span>
    </div>
    <div class="tool"><div class="tool-name">browser_launch</div><div class="tool-desc">Spawn a new Chrome instance with remote debugging</div></div>
    <div class="tool"><div class="tool-name">browser_connect</div><div class="tool-desc">Attach to an already-running Chrome via WebSocket URL</div></div>
    <div class="tool"><div class="tool-name">browser_disconnect</div><div class="tool-desc">Disconnect from Chrome (browser stays open)</div></div>
    <div class="tool"><div class="tool-name">browser_status</div><div class="tool-desc">Check connection state and number of active tabs</div></div>
  </div>

  <div class="group">
    <div class="group-header">
      <span class="group-icon">&#128195;</span>
      <span class="group-name">Tabs</span>
    </div>
    <div class="tool"><div class="tool-name">tab_list</div><div class="tool-desc">List all open page tabs and their URLs</div></div>
    <div class="tool"><div class="tool-name">tab_open</div><div class="tool-desc">Open a new tab and navigate to a URL</div></div>
    <div class="tool"><div class="tool-name">tab_navigate</div><div class="tool-desc">Navigate an existing tab to a new URL</div></div>
    <div class="tool"><div class="tool-name">tab_close</div><div class="tool-desc">Close a tab by targetId</div></div>
    <div class="tool"><div class="tool-name">tab_screenshot</div><div class="tool-desc">Capture a PNG/JPEG screenshot (viewport or full page)</div></div>
  </div>

  <div class="group">
    <div class="group-header">
      <span class="group-icon">&#128196;</span>
      <span class="group-name">Console</span>
    </div>
    <div class="tool"><div class="tool-name">console_start</div><div class="tool-desc">Begin recording console.log / warn / error / exceptions</div></div>
    <div class="tool"><div class="tool-name">console_stop</div><div class="tool-desc">Stop recording and detach Runtime listeners</div></div>
    <div class="tool"><div class="tool-name">console_get_logs</div><div class="tool-desc">Retrieve logs, optionally filtered by type or text search</div></div>
    <div class="tool"><div class="tool-name">console_clear</div><div class="tool-desc">Discard all captured log entries</div></div>
  </div>

  <div class="group">
    <div class="group-header">
      <span class="group-icon">&#128246;</span>
      <span class="group-name">Network Recording</span>
    </div>
    <div class="tool"><div class="tool-name">network_start_recording</div><div class="tool-desc">Enable Network domain and capture all requests + bodies</div></div>
    <div class="tool"><div class="tool-name">network_stop_recording</div><div class="tool-desc">Disable Network domain and stop capturing</div></div>
    <div class="tool"><div class="tool-name">network_get_requests</div><div class="tool-desc">Query captured requests (filter by URL, method, status, error)</div></div>
    <div class="tool"><div class="tool-name">network_clear_requests</div><div class="tool-desc">Clear the request history for a tab</div></div>
  </div>

  <div class="group">
    <div class="group-header">
      <span class="group-icon">&#128257;</span>
      <span class="group-name">Network Mocks</span>
    </div>
    <div class="tool"><div class="tool-name">network_add_mock</div><div class="tool-desc">Intercept requests matching a glob pattern and return a custom response</div></div>
    <div class="tool"><div class="tool-name">network_remove_mock</div><div class="tool-desc">Remove a mock rule by ID</div></div>
    <div class="tool"><div class="tool-name">network_list_mocks</div><div class="tool-desc">Show all active mock rules for a tab</div></div>
    <div class="tool"><div class="tool-name">network_clear_mocks</div><div class="tool-desc">Remove all mocks and disable request interception</div></div>
  </div>

  <div class="group">
    <div class="group-header">
      <span class="group-icon">&#9881;</span>
      <span class="group-name">Page</span>
    </div>
    <div class="tool"><div class="tool-name">page_evaluate</div><div class="tool-desc">Execute JavaScript in the tab and return the result</div></div>
    <div class="tool"><div class="tool-name">page_reload</div><div class="tool-desc">Reload the tab (optionally bypassing cache)</div></div>
    <div class="tool"><div class="tool-name">page_get_url</div><div class="tool-desc">Get the current URL and title of a tab</div></div>
  </div>

</div>

<div class="footer">
  <p>Connect your MCP client to this server, then use the tools above to control this Chrome instance.</p>
  <p style="margin-top:8px">Use <code>tab_open</code> to open your target URL, then <code>console_start</code> + <code>network_start_recording</code>.</p>
</div>
</body>
</html>`;
}

export async function injectWelcomePage(session: CDPSession, targetId: string): Promise<void> {
  await session.send('Page.enable');

  const frameTree = await session.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
  const frameId = frameTree.frameTree.frame.id;

  await session.send('Page.setDocumentContent', {
    frameId,
    html: buildWelcomeHTML(targetId),
  });
}
