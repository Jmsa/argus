# Skill: Network Debugging

Use this workflow to investigate network failures, slow requests, unexpected API responses,
and to verify that mocks are intercepting the right requests.

## Steps

1. **Set up recording**
   ```
   browser_launch { headless: false }
   tab_open { url: "https://your-site.com" }
   network_start_recording { targetId }
   console_start { targetId }   ← catches JS errors from failed fetches
   ```

2. **Navigate and exercise the page**
   ```
   tab_navigate { targetId, url: "https://your-site.com/dashboard" }
   page_evaluate { targetId, expression: "window.scrollTo(0, document.body.scrollHeight)" }
   ```

3. **Inspect all requests**
   ```
   network_get_requests { targetId }
   ```

4. **Filter to find problems**
   ```
   network_get_requests { targetId, hasError: true }        ← failed/cancelled
   network_get_requests { targetId, status: 404 }           ← not found
   network_get_requests { targetId, status: 500 }           ← server errors
   network_get_requests { targetId, url: "/api/orders" }    ← specific endpoint
   network_get_requests { targetId, method: "POST" }        ← mutations
   ```

5. **Inspect response bodies**
   - Response bodies are captured automatically in `loadingFinished`
   - Access via `network_get_requests` — each entry includes `responseBody`
   - Base64-encoded bodies are flagged with `responseBodyBase64: true`

6. **Verify mock interception**
   ```
   network_add_mock {
     targetId,
     urlPattern: "https://api.example.com/**",
     responseCode: 200,
     responseBody: '{"mocked": true}'
   }
   network_list_mocks { targetId }   ← confirm mock is registered
   page_reload { targetId }
   network_get_requests { targetId, url: "api.example.com" }
   ← status should be 200 and body should be '{"mocked": true}'
   ```

7. **Clean up and test real network**
   ```
   network_clear_mocks { targetId }
   network_clear_requests { targetId }
   page_reload { targetId }
   network_get_requests { targetId }   ← now shows real responses
   ```

## Reading Request Entries

Each request entry contains:

| Field | Description |
|---|---|
| `requestId` | Unique ID for correlating request/response |
| `url` | Full request URL |
| `method` | HTTP method |
| `headers` | Request headers |
| `postData` | Request body (for POST/PUT) |
| `status` | HTTP status code |
| `statusText` | HTTP status text |
| `responseHeaders` | Response headers |
| `mimeType` | Response MIME type |
| `responseBody` | Response body string |
| `responseBodyBase64` | True if body is base64-encoded |
| `duration` | Request duration in ms |
| `error` | Error text if request failed |
| `type` | Resource type (Document, XHR, Fetch, Script, etc.) |

## Tips

- Response bodies are only available if `network_start_recording` was called **before** the
  request was made. Reload the page after starting recording if needed.
- Large responses may be truncated by Chrome's buffer limits (50MB total by default).
- XHR/Fetch requests appear with `type: "XHR"` or `type: "Fetch"`.
- Use `page_evaluate` to trigger specific API calls without full page reload:
  ```
  page_evaluate {
    targetId,
    expression: "fetch('/api/data').then(r => r.json())"
  }
  ```
