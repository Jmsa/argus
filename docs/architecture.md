# Architecture

## Project Structure

```
argus/
├── src/
│   ├── types/
│   │   ├── cdp.ts          # CDP protocol types (commands, events, domain shapes)
│   │   └── config.ts       # ServerConfig, CdpConfig, DEFAULT_CONFIG, Chrome path detection
│   ├── cdp/
│   │   └── client.ts       # CDPClient (WebSocket) + CDPSession (per-tab multiplexer)
│   ├── browser/
│   │   └── manager.ts      # Chrome spawn, lifecycle, tab management
│   ├── domains/
│   │   ├── console.ts      # Runtime.consoleAPICalled + exceptionThrown recording
│   │   ├── screenshot.ts   # Page.captureScreenshot (viewport / full-page / clip)
│   │   ├── network.ts      # Network recording + Fetch domain mocking
│   │   └── ui.ts           # Welcome page + injectable overlay widget
│   └── server/
│       ├── tools.ts        # All 22 MCP tool definitions and handlers
│       └── index.ts        # Entry point — launches Chrome, connects MCP transport
├── skills/                 # Claude Code plugin skills (invocable via /argus:*)
│   ├── debug-session/SKILL.md
│   ├── repro-issue/SKILL.md
│   └── network-debug/SKILL.md
├── .claude-plugin/
│   └── plugin.json         # Plugin manifest for /plugin install Jmsa/argus
├── .mcp.json               # MCP server config bundled with plugin
└── docs/                   # This directory
```

## Dependency Graph

```
types/ ← cdp/client.ts ← browser/manager.ts
                               ↓
               domains/*.ts ───┤
                               ↓
                     server/tools.ts → server/index.ts
```

## Connection Model

Chrome exposes a single WebSocket endpoint at `ws://localhost:PORT/...`. All CDP commands and events for all tabs travel over this one connection, distinguished by a `sessionId` field.

```
CDPClient (one WebSocket)
  ├── CDPSession (sessionId: "AAA")  ← tab 1
  ├── CDPSession (sessionId: "BBB")  ← tab 2
  └── CDPSession (sessionId: "CCC")  ← tab 3
```

`CDPClient.send()` writes a JSON command with an auto-incrementing `id` and optional `sessionId`, then waits for the matching response. Events are routed to the correct `CDPSession` by `sessionId` and emitted as Node.js `EventEmitter` events.

## Startup Sequence

1. `BrowserManager.launch()` — spawns Chrome with `--remote-debugging-port` and a dedicated `--user-data-dir`
2. Reads Chrome's stderr until `DevTools listening on ws://...` appears — this gives the exact WebSocket URL
3. `CDPClient.connect()` — opens the WebSocket connection
4. `Target.createTarget({ url: 'about:blank' })` — opens the welcome tab
5. `Target.attachToTarget({ flatten: true })` — creates a `CDPSession` for that tab
6. `Page.setDocumentContent` — injects the Argus welcome page
7. `McpServer.connect(StdioServerTransport)` — MCP transport starts, tools become available

## Domain Modules

Each domain module takes a `CDPSession` and manages one area of CDP functionality independently.

### ConsoleDomain
Enables `Runtime` domain and subscribes to `Runtime.consoleAPICalled` and `Runtime.exceptionThrown`. Stores `ConsoleLogEntry[]` in memory. Supports filtering by type and text search.

### ScreenshotDomain
Calls `Page.captureScreenshot`. For full-page captures, calls `Page.getLayoutMetrics` first to get `contentSize` dimensions and passes them as a clip region.

### NetworkDomain
Two independent sub-systems that can run simultaneously:

**Recording** — enables the `Network` domain and listens to `requestWillBeSent`, `responseReceived`, `loadingFinished`, and `loadingFailed`. On `loadingFinished`, immediately calls `Network.getResponseBody` while the response is still buffered in Chrome's memory.

**Mocking** — enables the `Fetch` domain with URL patterns derived from the mock list. Every `Fetch.requestPaused` event must receive exactly one response (`Fetch.fulfillRequest` or `Fetch.continueRequest`) or Chrome hangs that request permanently. When mocks are added or removed, `Fetch.enable` is called again with the updated pattern list — this atomically replaces all patterns.

### UIDomain
Two injectable scripts:

- **Welcome page** — written into the tab via `Page.setDocumentContent` on startup
- **Overlay widget** — injected via `Page.addScriptToEvaluateOnNewDocument` (persists across navigations) and `Runtime.evaluate` (immediate injection). Exposes `window.__argusUpdateOverlay(data)` for external updates.

## Tab State

`server/tools.ts` maintains a `Map<targetId, TabState>` where each `TabState` holds a `CDPSession` and one instance of each domain module. Tab state is created lazily on first tool use for a given `targetId`.

```typescript
interface TabState {
  session: CDPSession;
  console: ConsoleDomain;
  screenshot: ScreenshotDomain;
  network: NetworkDomain;
}
```
