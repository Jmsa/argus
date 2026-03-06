---
name: debug-session
description: Capture a complete debugging snapshot of a web page using Argus — console logs, network traffic, and a screenshot. Use when asked to debug, inspect, or investigate a live page.
argument-hint: <url>
---

Capture a complete debugging snapshot of $ARGUMENTS using the Argus MCP tools.

## Steps

1. **Launch Chrome** (skip if already connected)
   ```
   browser_launch
   ```

2. **Open the target URL**
   ```
   tab_open { url: "$ARGUMENTS" }
   → note the returned targetId
   ```

3. **Start recording**
   ```
   console_start { targetId }
   network_start_recording { targetId }
   ```

4. **Trigger the behaviour to debug**
   - Use `tab_navigate` to navigate to a specific path
   - Use `page_evaluate` to run arbitrary JS (e.g. click buttons, trigger events)
   - Wait for async operations as needed

5. **Capture evidence**
   ```
   console_get_logs { targetId }                    ← all logs
   console_get_logs { targetId, type: "error" }     ← errors only
   network_get_requests { targetId }                ← all requests
   network_get_requests { targetId, hasError: true } ← failed requests
   tab_screenshot { targetId, fullPage: true }       ← full page PNG
   ```

6. **Summarise findings** — report:
   - Any console errors or warnings
   - Any failed or slow network requests
   - What the screenshot shows
   - Recommended next steps

7. **Iterate if needed**
   - Fix issues found in the logs
   - Use `page_reload` to test the fix
   - Repeat from step 5

## Tips

- Combine `console_get_logs { type: "error" }` with `network_get_requests { hasError: true }` to quickly triage failures.
- `page_evaluate` can inject scripts, read DOM state, or simulate user interactions.
- Screenshots are returned as base64 PNG and displayed inline in supported MCP clients.
