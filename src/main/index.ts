/**
 * Main-process entry: `import ... from 'cross-window-state/main'`.
 *
 * Importing this module is all the setup a main process needs — runtime IPC
 * handlers register via RuntimeStateManager's constructor and storage IPC
 * handlers via the ipc module's whenReady hook.
 */
import "./ipc";
import type { StorageStateOptions } from "../core/types";
import { StorageStore } from "./storage-store";

export { createRuntimeState } from "./runtime-state";
export type { RuntimeState } from "./runtime-state";
export { RuntimeStateManager, runtimeStateManager } from "./runtime-manager";
export { StorageStore } from "./storage-store";
export { SyncArray } from "../core/sync-array";
export type { RuntimeStateLike } from "../core/sync-array";
export type { RuntimeStateOptions, StorageStateOptions } from "../core/types";

/** API-surface alias: the storage state on main is the store itself. */
export type StorageState<T extends Record<string, unknown>> = StorageStore<T>;

/**
 * Create (or reuse) a persistent store. Same name+version+defaults returns
 * the live instance; a different version migrates and rebuilds.
 */
export function createStorageState<T extends Record<string, unknown>>(
  name: string,
  defaults: T,
  version: number,
  options?: StorageStateOptions,
): StorageStore<T> {
  return new StorageStore(name, defaults, version, options);
}
