---
name: repro-issue
description: Reproduce a bug and use Argus network mocks to isolate whether it is caused by the frontend or a specific API response. Use when asked to reproduce, isolate, or bisect a bug.
argument-hint: <url> <description of bug>
---

Reproduce and isolate the following issue using Argus: $ARGUMENTS

## Steps

1. **Launch and set up recording**
   ```
   browser_launch
   tab_open { url: "about:blank" }
   console_start { targetId }
   network_start_recording { targetId }
   ```

2. **Add mocks for controlled API responses**
   ```
   network_add_mock {
     targetId,
     urlPattern: "**/api/endpoint",
     responseCode: 200,
     responseBody: '{"key": "value"}',
     responseHeaders: { "content-type": "application/json" }
   }
   ```
   - Use `**` to match any prefix/suffix
   - Mock the API state expected to trigger the bug

3. **Navigate and trigger the issue**
   ```
   tab_navigate { targetId, url: "https://your-site.com/path" }
   page_evaluate { targetId, expression: "document.querySelector('.submit-btn').click()" }
   ```

4. **Capture failure evidence**
   ```
   console_get_logs { targetId, type: "error" }
   network_get_requests { targetId, hasError: true }
   tab_screenshot { targetId, fullPage: true }
   ```

5. **Iterate mocks to find the root cause**
   - Remove the mock: `network_remove_mock { targetId, mockId }`
   - Add a different mock with different data
   - Reload and check if the bug disappears: `page_reload { targetId }`
   - Compare screenshots and logs to pinpoint the problematic state

6. **Verify the fix**
   ```
   network_clear_mocks { targetId }
   network_add_mock { targetId, urlPattern: "**/api/endpoint", responseCode: 200, responseBody: '{"fixed": true}' }
   page_reload { targetId }
   console_get_logs { targetId, type: "error" }   ← should be empty
   tab_screenshot { targetId }                     ← should show fixed state
   ```

7. **Report findings** — include:
   - Which mock configuration reproduced the bug
   - Which change made it disappear
   - Screenshot evidence of both states
   - Recommended fix

## Common Mock Patterns

| Scenario | Mock setup |
|---|---|
| Empty API response | `responseBody: '[]'` or `'{}'` |
| API error | `responseCode: 500, responseBody: '{"error":"Internal Server Error"}'` |
| Auth failure | `responseCode: 401, responseBody: '{"error":"Unauthorized"}'` |

## Tips

- Mock evaluation is first-match — order matters when multiple mocks could match.
- Use `network_list_mocks { targetId }` to verify your mock setup before navigating.
- `console_clear` and `network_clear_requests` before each test run keeps the data clean.
