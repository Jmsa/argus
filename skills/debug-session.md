# Skill: Debug Session

Use this workflow when you want to capture a complete debugging snapshot of a web page —
console logs, network traffic, and a screenshot.

## Steps

1. **Launch Chrome**
   ```
   browser_launch { headless: false }
   ```

2. **Open the target URL**
   ```
   tab_open { url: "https://your-site.com" }
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
   console_get_logs { targetId }               ← all logs
   console_get_logs { targetId, type: "error" } ← errors only
   network_get_requests { targetId }            ← all requests
   network_get_requests { targetId, hasError: true } ← failed requests
   tab_screenshot { targetId, fullPage: true }  ← full page PNG
   ```

6. **Iterate**
   - Fix issues found in the logs
   - Use `page_reload` to test the fix
   - Repeat from step 5

7. **Clean up**
   ```
   browser_disconnect
   ```

## Tips

- Combine `console_get_logs { type: "error" }` with `network_get_requests { hasError: true }`
  to quickly triage failures.
- `page_evaluate` can inject scripts, read DOM state, or simulate user interactions.
- Screenshots are returned as base64 PNG — MCP clients that support image content will
  display them inline.
