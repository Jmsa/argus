# Network Mocking

Argus intercepts requests using Chrome's `Fetch` domain, which sits earlier in the request pipeline than the `Network` domain. Mocks are evaluated before the request leaves the browser.

## Adding a Mock

```
network_add_mock {
  targetId: "...",
  urlPattern: "**/api/users",
  responseCode: 200,
  responseBody: '{"users": []}',
  responseHeaders: { "content-type": "application/json" }
}
```

Returns a `mockId` you can use to remove the mock later.

## URL Pattern Syntax

Patterns use glob matching:

| Pattern | Matches |
|---|---|
| `*` | Any characters except `/` |
| `**` | Any characters including `/` |
| `https://example.com/api/*` | Any path under `/api/` on that exact host |
| `**/api/users` | `/api/users` on any host |
| `**` | Every URL |

Examples:

```
**/api/**          → all requests with /api/ anywhere in the path
https://api.example.com/**  → all requests to api.example.com
*.example.com/**   → all subdomains of example.com
```

## Method Filtering

By default a mock matches any HTTP method. To restrict to a specific method:

```
network_add_mock {
  urlPattern: "**/api/users",
  method: "POST",
  responseCode: 201,
  responseBody: '{"id": 1}'
}
```

## Mock Priority

Mocks are evaluated in the order they were added. The first match wins. Add more specific patterns before broader ones.

```
# This order means the specific 404 takes priority over the catch-all 200
network_add_mock { urlPattern: "**/api/missing", responseCode: 404 }
network_add_mock { urlPattern: "**/api/**", responseCode: 200 }
```

## Response Body Encoding

The `responseBody` is sent as UTF-8. Argus base64-encodes it before passing it to `Fetch.fulfillRequest`. For binary responses, provide a base64 string and set `content-type` accordingly.

## Running Mocks Alongside Recording

Network recording (`network_start_recording`) and mocking (`network_add_mock`) operate independently and can run simultaneously.

- The `Network` domain sees the mocked response, not the original server response
- Mocked requests appear in `network_get_requests` with the mock's status code
- The response body in `network_get_requests` reflects the mock body

## How It Works Internally

1. `Fetch.enable` is called with a list of URL patterns derived from all active mocks
2. For every matching request, Chrome pauses it and fires `Fetch.requestPaused`
3. Argus checks the URL against active mocks in order
4. On a match: `Fetch.fulfillRequest` with the mock response
5. No match: `Fetch.continueRequest` to let the request proceed normally

Every `Fetch.requestPaused` event **must** receive exactly one response. Argus wraps handlers in try/catch and falls back to `continueRequest` on any error to prevent Chrome from hanging the request permanently.

When mocks are added or removed, `Fetch.enable` is called again with the updated full pattern list — this atomically replaces all interception patterns in Chrome.

## Removing Mocks

```
network_remove_mock { targetId: "...", mockId: "uuid" }
network_clear_mocks { targetId: "..." }
```

When the last mock is removed, `Fetch.disable` is called and request interception stops entirely.
