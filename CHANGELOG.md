# cross-window-state

## 0.1.0

### Minor Changes

- [#1](https://github.com/amwtxgt/cross-window-state/pull/1) [`c1e842c`](https://github.com/amwtxgt/cross-window-state/commit/c1e842cfe42cc5cb98ccb47014f6f27035da93e3) Thanks [@amwtxgt](https://github.com/amwtxgt)! - First public release: shared reactive state for Electron multi-window apps and cross-tab web apps.

  - Zero-difference DX: identical `createRuntimeState` / `createStorageState` on main and renderer, locked by a shared contract suite
  - Runtime states with reference-counted garbage collection; storage states with versioned migration and atomic persisted writes
  - Dual host: Electron (IPC) and plain web (localStorage + BroadcastChannel) with the same renderer code
  - Optional Vue bridge (`useRuntimeState` / `useStorageState`)
