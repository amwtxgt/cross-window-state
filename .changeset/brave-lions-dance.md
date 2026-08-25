---
"cross-window-state": minor
---

First public release: shared reactive state for Electron multi-window apps and cross-tab web apps.

- Zero-difference DX: identical `createRuntimeState` / `createStorageState` on main and renderer, locked by a shared contract suite
- Runtime states with reference-counted garbage collection; storage states with versioned migration and atomic persisted writes
- Dual host: Electron (IPC) and plain web (localStorage + BroadcastChannel) with the same renderer code
- Optional Vue bridge (`useRuntimeState` / `useStorageState`)
