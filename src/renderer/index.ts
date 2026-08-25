/**
 * Renderer entry: `import ... from 'cross-window-state/renderer'`.
 *
 * Works in Electron windows (via the preload bridge) and plain web pages
 * (localStorage + BroadcastChannel fallback) with identical semantics.
 */
export { createRuntimeState } from "./runtime-state";
export type { RuntimeState } from "./runtime-state";
export { createStorageState } from "./storage-state";
export type { StorageState } from "./storage-state";
export { SyncArray } from "../core/sync-array";
export type { RuntimeStateLike } from "../core/sync-array";
export { localRuntimeBus, localStorageBus } from "./local-bus";
