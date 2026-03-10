---
name: welcome
description: Open the Argus welcome page in the browser. Use when asked to show or open the Argus welcome/home screen.
---

Open the Argus welcome page in a browser tab.

## Steps

1. **Launch Chrome** (skip if already connected)

   ```
   browser_launch
   ```

2. **Open a blank tab**

   ```
   tab_open { url: "about:blank" }
   → note the returned targetId
   ```

3. **Navigate to the welcome page**
   ```
   tab_navigate { targetId, url: "http://127.0.0.1:7842/?targetId=<targetId>" }
   ```
