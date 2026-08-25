/**
 * Root entry of cross-window-state: the framework-agnostic, dependency-free
 * core — IPC protocol, shared types and SyncArray. Safe to import from any
 * process (main, preload, renderer, plain Node).
 */
export { channel, runtimeUpdateChannel, storageUpdateChannel } from "./core/protocol";
export type { RuntimeUpdatePayload, StorageSetPayload, StorageGetPayload } from "./core/protocol";
export type { RuntimeStateOptions, StorageStateOptions } from "./core/types";
export { SyncArray } from "./core/sync-array";
export type { RuntimeStateLike } from "./core/sync-array";
