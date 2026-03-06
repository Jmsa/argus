# CDP MCP Server — Implementation Plan

## Context

Build a TypeScript MCP server that wraps the Chrome DevTools Protocol (CDP) to expose
browser debugging capabilities (console recording, screenshots, network recording +
mocking) without Puppeteer/Playwright. Chrome is auto-launched as a child process.
The injectable UI is delivered purely via CDP (Page.addScriptToEvaluateOnNewDocument).

---

## Tech Stack & Dependencies

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server/transport/tool registration |
| `ws` | WebSocket client (Node.js native WS unreliable pre-v22) |
| `zod` | Tool input schemas (required peer dep of MCP SDK) |
| `tsx` (dev) | TypeScript watch runner, zero-config |
| `typescript` (dev) | Compiler |

Node ≥ 18. ESM (`"type": "module"`). `module: NodeNext` in tsconfig.

---

## Project Structure

```
cdp/
├── package.json
├── tsconfig.json
├── .gitignore
├── PLAN.md
├── skills/
│   ├── debug-session.md
│   ├── repro-issue.md
│   └── network-debug.md
└── src/
    ├── types/
    │   ├── cdp.ts          # CDP protocol types (commands, events, per-domain shapes)
    │   └── config.ts       # CdpConfig + ServerConfig interfaces + DEFAULT_CONFIG
    ├── cdp/
    │   └── client.ts       # CDPClient (WebSocket) + CDPSession (per-tab multiplexer)
    ├── browser/
    │   └── manager.ts      # Chrome spawn, lifecycle, listTabs/openTab/attachToTab
    ├── domains/
    │   ├── console.ts      # Runtime.consoleAPICalled + exceptionThrown
    │   ├── screenshot.ts   # Page.captureScreenshot
    │   ├── network.ts      # Network recording + Fetch mocking
    │   └── ui.ts           # OVERLAY_SCRIPT string + injectOverlay() + updateOverlay()
    └── server/
        ├── tools.ts        # registerAllTools() — all MCP tool definitions + handlers
        └── index.ts        # McpServer bootstrap, StdioServerTransport
```

---

## CDP Protocol — Key Details

### Connecting to Chrome

Chrome is launched with `--remote-debugging-port=9222`. Discovery endpoints:

| Endpoint | Use |
|---|---|
| `GET /json` | List all targets (tabs, workers) |
| `GET /json/version` | Browser metadata + `webSocketDebuggerUrl` |

WebSocket connection per tab: `ws://localhost:9222/devtools/page/{targetId}`

### Domain Reference

| Goal | Domain | Key API |
|---|---|---|
| Console recording | `Runtime` | `enable`, `consoleAPICalled` event, `exceptionThrown` event |
| Screenshots | `Page` | `captureScreenshot`, `getLayoutMetrics` |
| Network recording | `Network` | `enable`, `requestWillBeSent`, `responseReceived`, `loadingFinished`, `getResponseBody` |
| Network mocking | `Fetch` | `enable` (with patterns), `requestPaused` event, `fulfillRequest`, `continueRequest` |
| Tab management | `Target` | `getTargets`, `createTarget`, `attachToTarget` (flatten:true) |
| UI injection | `Page` + `Runtime` | `addScriptToEvaluateOnNewDocument`, `evaluate` |

**Critical constraint:** Every `Fetch.requestPaused` event must be answered with `fulfillRequest`, `continueRequest`, or `failRequest` — or Chrome hangs that request indefinitely.

---

## Implementation Phases

### Phase 1 — Foundation
Files: `package.json`, `tsconfig.json`, `.gitignore`, `src/types/cdp.ts`, `src/types/config.ts`, `src/cdp/client.ts`

**CDPClient (`src/cdp/client.ts`):**
- WebSocket connection to Chrome's debugger URL
- `send(method, params?, sessionId?)` → `Promise<T>` — tracks in-flight commands by auto-incrementing ID, times out at 30s
- `handleMessage(raw)` — if `msg.id` exists → resolve/reject pending; else route event to correct session by `msg.sessionId`
- `CDPSession` extends EventEmitter, wraps `send()` with a fixed sessionId
- Reconnect with exponential backoff (500ms → 5s cap); rejects all pending commands on disconnect

**Verification gate:** Ad-hoc script connects to a manually-started Chrome, sends `Browser.getVersion`, logs response.

### Phase 2 — Browser Manager
File: `src/browser/manager.ts`

- `launch()`: `child_process.spawn(executablePath, REQUIRED_FLAGS + optional HEADLESS_FLAGS, { stdio: ['ignore','pipe','pipe'] })`
- Poll `http://localhost:{port}/json` every 200ms up to 15s
- `GET /json/version` → `webSocketDebuggerUrl` → `new CDPClient(wsUrl).connect()`
- Platform default paths:
  - macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  - Linux: `/usr/bin/google-chrome`
  - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `listTabs()` → `GET /json` filtered to `type === 'page'`
- `attachToTab(targetId)` → `Target.attachToTarget({ targetId, flatten: true })` → returns `CDPSession`
- `registerShutdownHooks()`: SIGINT/SIGTERM → graceful shutdown; `process.on('exit')` → SIGKILL

**Chrome launch flags (always):**
```
--remote-debugging-port=PORT
--no-first-run
--no-default-browser-check
--disable-extensions
--disable-background-networking
--password-store=basic
--use-mock-keychain
```

**Headless adds:** `--headless=new --hide-scrollbars --mute-audio`

**Verification gate:** `manager.launch()` spawns Chrome, `listTabs()` returns results, `attachToTab()` returns a CDPSession that can send `Page.navigate`.

### Phase 3 — Domain Modules

**`src/domains/console.ts` — ConsoleDomain:**
- `startRecording()`: `Runtime.enable`, subscribe to `Runtime.consoleAPICalled` + `Runtime.exceptionThrown`
- Store `ConsoleLogEntry[]`: `{ type, text, timestamp, url?, lineNumber?, args, isException }`
- Serialize `RemoteObject` args: use `.value` if present, else `.description`
- `stopRecording()`: `Runtime.disable`, remove listeners
- `getLogs(filter?)`, `clearLogs()`

**`src/domains/screenshot.ts` — ScreenshotDomain:**
- `capture(options)`: optional clip region; if `fullPage`, call `Page.getLayoutMetrics` first for `contentSize`
- Returns `{ data: string (base64), mimeType, width, height }`

**`src/domains/network.ts` — NetworkDomain (most complex):**
- Recording: `Network.enable`, subscribe to `requestWillBeSent`, `responseReceived`, `loadingFailed`
- On `loadingFinished` → call `Network.getResponseBody` immediately (only works while response is still buffered; wrap in try/catch for cached/streaming responses)
- Mocking: `Fetch.enable` with patterns from mock list; on `Fetch.requestPaused` → glob-match against mocks
  - Match found → `Fetch.fulfillRequest` with mock body (base64-encoded)
  - No match → `Fetch.continueRequest` (pass-through)
- `addMock()` → assign UUID, call `refreshFetchDomain()` to re-enable Fetch with updated pattern list
- `removeMock(id)` → splice from list, `refreshFetchDomain()`
- Glob pattern matching: `*` → `[^/]*`, `**` → `.*`

**`src/domains/ui.ts` — Injectable overlay:**
- `OVERLAY_SCRIPT`: self-contained IIFE string (no ES module syntax — must work in any browser context)
- Floating panel (fixed position, draggable, z-index 2147483647): status dot, console count, network count, screenshot button
- Guards against double injection: `if (window.__cdpOverlay) return;`
- `window.__cdpUpdateOverlay(data)` exposed for external updates
- `injectOverlay(session)`: `Page.addScriptToEvaluateOnNewDocument` + `Runtime.evaluate` for immediate injection
- `updateOverlay(session, data)`: `Runtime.evaluate` calling `window.__cdpUpdateOverlay`

**Verification gate (network):** Mock-matching URL fulfills with mock body. Non-matching URL continues. Both complete without hanging.

### Phase 4 — MCP Server

**`src/server/tools.ts`:**
- Session registry: `Map<targetId, TabState>` where `TabState = { session, console, screenshot, network }`
- `getOrCreateTabState(targetId)`: lazily attach and initialize all domain modules on first call
- All tools wrap logic in try/catch; errors return `{ content: [{ type:'text', text: JSON.stringify({error}) }], isError: true }`
- Screenshots return both a text metadata content item AND an image content item

**MCP Tools (22 total):**

| Group | Tool | Key inputs |
|---|---|---|
| Browser | `browser_launch` | `port?`, `executablePath?`, `headless?` |
| Browser | `browser_connect` | `port?` |
| Browser | `browser_disconnect` | — |
| Browser | `browser_status` | — |
| Tabs | `tab_list` | — |
| Tabs | `tab_open` | `url?` |
| Tabs | `tab_navigate` | `targetId`, `url` |
| Tabs | `tab_close` | `targetId` |
| Tabs | `tab_screenshot` | `targetId`, `format?`, `quality?`, `fullPage?`, `clip?` |
| Console | `console_start` | `targetId` |
| Console | `console_stop` | `targetId` |
| Console | `console_get_logs` | `targetId`, `type?`, `limit?`, `since?` |
| Console | `console_clear` | `targetId` |
| Network | `network_start_recording` | `targetId` |
| Network | `network_stop_recording` | `targetId` |
| Network | `network_get_requests` | `targetId`, `urlFilter?`, `method?`, `statusMin?`, `statusMax?`, `includeBody?`, `limit?` |
| Network | `network_clear_requests` | `targetId` |
| Mocks | `network_add_mock` | `targetId`, `urlPattern`, `method?`, `responseCode`, `responseBody`, `responseHeaders?` |
| Mocks | `network_remove_mock` | `targetId`, `mockId` |
| Mocks | `network_list_mocks` | `targetId` |
| Mocks | `network_clear_mocks` | `targetId` |
| Page | `page_evaluate` | `targetId`, `expression`, `awaitPromise?` |
| Page | `page_reload` | `targetId`, `ignoreCache?` |
| Page | `page_get_url` | `targetId` |

**`src/server/index.ts`:**
```typescript
const server = new McpServer({ name: 'cdp-mcp-server', version: '1.0.0' });
registerAllTools(server, browserManager);
await server.connect(new StdioServerTransport());
```

**Verification gate:** Run `npm run dev`, use MCP inspector. Call `browser_launch` → `tab_open` → `tab_screenshot`. Verify base64 PNG returns in image content item.

### Phase 5 — Skills
Files: `skills/debug-session.md`, `skills/repro-issue.md`, `skills/network-debug.md`

Workflow guides for Claude to follow when invoked:
- **`debug-session.md`**: launch → open tab → start console+network recording → interact → capture evidence (screenshot + logs + requests)
- **`repro-issue.md`**: add mocks first → start recording → navigate → capture failure state → iterate mocks → `page_reload` to re-test
- **`network-debug.md`**: record all requests → filter by status/URL → inspect bodies → mock the fix to verify frontend behavior

---

## Key Implementation Notes

1. **NodeNext imports:** All relative imports must use `.js` extension (e.g., `import { X } from './types/cdp.js'`)
2. **Multi-tab multiplexing:** `Target.attachToTarget({ flatten: true })` — all session messages share one WebSocket, distinguished by `sessionId` field in each message
3. **Console domain:** Use `Runtime` domain only — `Runtime.consoleAPICalled` gives typed `RemoteObject` args. The `Console` domain is deprecated.
4. **Response body timing:** `Network.getResponseBody` must be called in the `loadingFinished` handler while response is still in memory — can silently fail for cached/streaming responses, always wrap in try/catch
5. **Fetch pattern refresh:** `Fetch.enable` replaces all existing patterns atomically — re-call with the full pattern list on every mock add/remove
6. **Chrome stderr:** Pipe and discard (`stdio: ['ignore','pipe','pipe']`). Never inherit; it will block the process with buffered output.

---

## Dependency Graph

```
src/types/ ──────────────────────────────────┐
                                             ↓
src/cdp/client.ts ──────────────────► src/browser/manager.ts
                                             ↓
                            src/domains/{console,screenshot,network,ui}.ts
                                             ↓
                                    src/server/tools.ts
                                             ↓
                                    src/server/index.ts
```

---

## End-to-End Verification Sequence

1. `npm run dev` — MCP server starts on stdio
2. Connect MCP inspector
3. `browser_launch` → Chrome opens
4. `tab_open { url: "https://example.com" }` → note returned `targetId`
5. `console_start { targetId }` + `network_start_recording { targetId }`
6. `network_add_mock { targetId, urlPattern: "https://example.com/**", responseCode: 200, responseBody: "{\"mocked\":true}" }` → note `mockId`
7. `page_evaluate { targetId, expression: "console.error('test error')" }`
8. `console_get_logs { targetId, type: "error" }` → returns the test error entry
9. `tab_screenshot { targetId, fullPage: true }` → base64 PNG in image content item
10. `network_list_mocks { targetId }` → shows the active mock
11. `network_remove_mock { targetId, mockId }` → removes mock
12. `network_get_requests { targetId, includeBody: true }` → shows recorded requests with bodies
13. `browser_disconnect` → server stays alive, Chrome stays open
