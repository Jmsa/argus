# Argus DOM Interaction Skill

Use this workflow to interact with and test page UIs using Argus DOM tools.

## Tools Available

| Tool | Purpose |
|---|---|
| `dom_query` | Inspect a single element (tag, text, rect, attributes, visibility) |
| `dom_query_all` | Inspect multiple elements matching a selector |
| `dom_click` | Click an element (scrolls into view first) |
| `dom_input_value` | Type into an input (dispatches React/Vue-compatible events) |
| `dom_get_value` | Read the current value of an input |
| `dom_wait_for` | Poll until an element exists (and optionally is visible) |

## Standard Workflow

### 1. Open and inspect the page

```
tab_open { url: "https://your-app.com" }
→ note the targetId

dom_query { targetId, selector: "h1" }
→ confirms page loaded, shows title text and rect
```

### 2. Fill a form

```
dom_input_value { targetId, selector: "input[name=email]", text: "user@example.com", clear: true }
dom_input_value { targetId, selector: "input[name=password]", text: "secret", clear: true }
dom_click { targetId, selector: "button[type=submit]" }
```

### 3. Wait for async results

After triggering navigation or an API call, wait for the result to appear:

```
dom_wait_for { targetId, selector: ".results-list", timeout: 5000, visible: true }
```

If the wait times out, take a screenshot to diagnose:

```
tab_screenshot { targetId }
```

### 4. Assert content

```
dom_query { targetId, selector: ".success-message" }
→ check info.text matches expected value

dom_query_all { targetId, selector: "table tbody tr" }
→ check returned array length matches expected row count
```

### 5. Interact with dynamic UI

For React/Vue controlled inputs, `dom_input_value` uses the native input value setter and dispatches `input` + `change` events — this correctly triggers framework state updates.

For custom components that don't use native inputs, fall back to `page_evaluate` with custom JS.

## Tips

- Use `dom_query` before `dom_click` to confirm the element exists and is visible
- `dom_query_all` with `limit` keeps results manageable for large lists
- `dom_wait_for { visible: true }` is more reliable than `dom_wait_for` alone after animations
- Combine with `console_start` + `network_start_recording` to capture side effects of interactions
- If `dom_click` doesn't work (e.g. custom event handlers), use `page_evaluate` to dispatch a `MouseEvent`
