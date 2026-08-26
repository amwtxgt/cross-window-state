---
"cross-window-state": patch
---

Fix: `useRuntimeState` / `useStorageState` no longer trigger a Vue warning when called outside an active effect scope (module-level singleton consumers); disposal hooks are now registered only when a scope exists.
