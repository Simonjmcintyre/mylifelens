---
name: Replit GitHub remotes
description: Replit Git UI behavior when linking an existing GitHub repository
---

The Git pane’s **Create Remote** control can open the “Create Repository on GitHub” dialog even when an existing repository is intended. For an already-created repository, configure its HTTPS remote URL and use the Git pane’s **Push** action with the active GitHub connection.

**Why:** The new-repository dialog defaults to the Replit app name and does not link an existing repository; command-line HTTPS pushes may also fail because GitHub password authentication is unsupported.

**How to apply:** Confirm the remote points to the intended repository, use the Git pane’s Push/Sync control, and verify the repository’s `main` branch on GitHub before moving on.