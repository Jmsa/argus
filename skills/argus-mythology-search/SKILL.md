---
name: argus-mythology-search
description: Replay the recorded session that searches Google for "what is argus in greek mythology?" and opens the Wikipedia article for Argus Panoptes.
---

Replay the recorded browser session using Argus MCP tools.

## Steps

1. **Launch Chrome** (skip if already connected)
   ```
   browser_launch
   ```

2. **Open Google**
   ```
   tab_open { url: "https://www.google.com" }
   → note the returned targetId
   ```

3. **Search for Argus in Greek mythology**
   ```
   page_evaluate {
     targetId,
     expression: `
       const input = document.querySelector('textarea[name="q"], input[name="q"]');
       input.focus();
       input.value = 'what is argus in greek mythology?';
       input.dispatchEvent(new Event('input', { bubbles: true }));
       document.querySelector('form').submit();
     `
   }
   ```

4. **Navigate to the Wikipedia article**
   ```
   tab_navigate { targetId, url: "https://en.wikipedia.org/wiki/Argus_Panoptes" }
   ```

5. **Take a screenshot to confirm**
   ```
   tab_screenshot { targetId }
   ```
