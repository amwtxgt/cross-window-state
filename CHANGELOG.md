# cross-window-state

## 0.1.1

### Patch Changes

- [`5073e17`](https://github.com/amwtxgt/cross-window-state/commit/5073e1716d78e0dc201180bc2311af771bdc4d92) Thanks [@amwtxgt](https://github.com/amwtxgt)! - fix(web): late-joining tabs now hydrate runtime state from live peers. Previously a tab opened after a runtime value was set sat on its default until the next write; subscribing with no local value now broadcasts a hydrate request and any tab holding the value answers. Memory-only semantics are unchanged — nothing is persisted.

## 0.1.0

### Minor Changes

- [#1](https://github.com/amwtxgt/cross-window-state/pull/1) [`c1e842c`](https://github.com/amwtxgt/cross-window-state/commit/c1e842cfe42cc5cb98ccb47014f6f27035da93e3) Thanks [@amwtxgt](https://github.com/amwtxgt)! - First public release: shared reactive state for Electron multi-window apps and cross-tab web apps.

  - Zero-difference DX: identical `createRuntimeState` / `createStorageState` on main and renderer, locked by a shared contract suite
  - Runtime states with reference-counted garbage collection; storage states with versioned migration and atomic persisted writes
  - Dual host: Electron (IPC) and plain web (localStorage + BroadcastChannel) with the same renderer code
  - Optional Vue bridge (`useRuntimeState` / `useStorageState`)
