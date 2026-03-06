# Configuration

## Chrome Path Detection

Argus automatically finds the Chrome executable at startup by checking candidate paths in order, preferring Canary over stable:

| Platform | Candidates (in order) |
|---|---|
| macOS | Chrome Canary → Chrome stable |
| Linux | `google-chrome-canary` → `google-chrome-stable` → `google-chrome` → `chromium` |
| Windows | Chrome Canary (LocalAppData) → Chrome stable (Program Files) |

To use a specific binary, set `executablePath` in the `ServerConfig`:

```typescript
const manager = new BrowserManager({
  executablePath: '/usr/bin/chromium-browser',
});
```

## Debugging Port

Default port is `9222`. Chrome is launched with `--remote-debugging-port=9222`.

To use a different port, pass it in the CDP config:

```typescript
const manager = new BrowserManager({
  cdp: { port: 9333 },
});
```

## Chrome Profile

By default, Chrome uses a dedicated profile at `~/.argus/chrome-profile`. This is required — Chrome Canary refuses to expose remote debugging on the default user profile.

Using a persistent directory means Chrome retains cached resources and settings between restarts. To use a different location:

```typescript
const manager = new BrowserManager({
  userDataDir: '/path/to/my/profile',
});
```

## Headless Mode

Headless is off by default (`headless: false`) so Chrome opens visibly. To run headless:

```typescript
const manager = new BrowserManager({
  headless: true,
});
```

Headless mode adds `--headless=new --hide-scrollbars --mute-audio`.

## Extra Flags

Pass any additional Chrome flags via `extraFlags`:

```typescript
const manager = new BrowserManager({
  extraFlags: [
    '--disable-web-security',
    '--ignore-certificate-errors',
    '--proxy-server=http://localhost:8080',
  ],
});
```

## Timeouts

All timeouts are in milliseconds:

| Option | Default | Description |
|---|---|---|
| `connectTimeout` | `15000` | How long to wait for Chrome to start and open the debug port |
| `commandTimeout` | `30000` | How long before a CDP command times out |
| `reconnectDelay` | `500` | Initial delay before reconnecting after WebSocket drop |
| `reconnectMaxDelay` | `5000` | Maximum reconnect backoff delay |

```typescript
const manager = new BrowserManager({
  cdp: {
    connectTimeout: 30000,
    commandTimeout: 10000,
  },
});
```

## Launch Flags Reference

Flags always applied:

```
--remote-debugging-port=PORT
--user-data-dir=PATH
--no-first-run
--no-default-browser-check
--no-profile-picker
--profile-directory=Default
--disable-extensions
--disable-background-networking
--password-store=basic
--use-mock-keychain
```

Additional flags in headless mode:

```
--headless=new
--hide-scrollbars
--mute-audio
```
