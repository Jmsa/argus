---
name: network-debug
description: Investigate network failures, slow requests, and unexpected API responses using Argus. Use when asked to debug network issues, API calls, or request/response problems.
argument-hint: <url>
---

Investigate network activity on $ARGUMENTS using the Argus MCP tools.

## Steps

1. **Set up recording**
   ```
   browser_launch
   tab_open { url: "$ARGUMENTS" }
   network_start_recording { targetId }
   console_start { targetId }
   ```

2. **Navigate and exercise the page**
   ```
   tab_navigate { targetId, url: "$ARGUMENTS" }
   page_evaluate { targetId, expression: "window.scrollTo(0, document.body.scrollHeight)" }
   ```

3. **Inspect all requests**
   ```
   network_get_requests { targetId }
   ```

4. **Filter to find problems**
   ```
   network_get_requests { targetId, hasError: true }         ← failed/cancelled
   network_get_requests { targetId, status: 404 }            ← not found
   network_get_requests { targetId, status: 500 }            ← server errors
   network_get_requests { targetId, url: "/api/orders" }     ← specific endpoint
   network_get_requests { targetId, method: "POST" }         ← mutations
   ```

5. **Verify mock interception if needed**
   ```
   network_add_mock {
     targetId,
     urlPattern: "https://api.example.com/**",
     responseCode: 200,
     responseBody: '{"mocked": true}'
   }
   network_list_mocks { targetId }
   page_reload { targetId }
   network_get_requests { targetId, url: "api.example.com" }
   ```

6. **Clean up and test real network**
   ```
   network_clear_mocks { targetId }
   network_clear_requests { targetId }
   page_reload { targetId }
   network_get_requests { targetId }
   ```

7. **Report findings** — include:
   - Failed or errored requests with status codes
   - Slow requests (high `duration` values)
   - Unexpected response bodies or status codes
   - Screenshot of the page state
   - Recommended fixes

## Request Entry Fields

| Field | Description |
|---|---|
| `url` | Full request URL |
| `method` | HTTP method |
| `status` | HTTP status code |
| `mimeType` | Response MIME type |
| `responseBody` | Response body string |
| `duration` | Request duration in ms |
| `error` | Error text if request failed |
| `type` | Resource type (XHR, Fetch, Script, etc.) |

## Tips

- Response bodies are only available if `network_start_recording` was called **before** the request. Reload after starting recording if needed.
- Use `page_evaluate` to trigger specific API calls without a full page reload:
  ```
  page_evaluate { targetId, expression: "fetch('/api/data').then(r => r.json())" }
  ```
