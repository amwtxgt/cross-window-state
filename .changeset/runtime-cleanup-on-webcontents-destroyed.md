---
"cross-window-state": patch
---

Fix: automatically unregister and garbage-collect runtime states when a renderer `webContents` is destroyed without calling `destroy()`. Previously `RuntimeStateManager` kept dead sender IDs in `rendererIds` (preventing `maybeCleanup` from freeing per-window named states once the main process released them), and `broadcast()` left empty subscriber arrays instead of cleaning up.
