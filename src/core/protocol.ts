import type { StorageStateOptions } from "./types";

/**
 * IPC wire protocol shared by main, preload and renderer.
 *
 * Every channel is prefixed with `cws:` (cross-window-state) so the library
 * can never collide with host-app channels. Update channels embed the state
 * name (and optionally the key) so subscriptions are narrowly scoped.
 */

/** Base channel names. Update events append `:{key}` / `:{name}[:{key}]`. */
export const channel = {
  /** renderer → main, `send`, payload `{ key, value }`. */
  runtimeSet: "cws:runtime:set",
  /** renderer → main, `sendSync`, returns current value; registers sender for broadcasts. */
  runtimeGet: "cws:runtime:get",
  /** renderer → main, `send`, unregisters sender; may release the state. */
  runtimeClear: "cws:runtime:clear",
  /** Base for main → renderer broadcast channels: `cws:runtime:update:{key}`. */
  runtimeUpdate: "cws:runtime:update",
  /** renderer → main, `sendSync`, returns merged state; creates the store on first call. */
  storageGet: "cws:storage:get",
  /** renderer → main, `send`, payload `{ name, patch }`. */
  storageSet: "cws:storage:set",
  /** Base for main → renderer broadcast channels: `cws:storage:update:{name}[:{key}]`. */
  storageUpdate: "cws:storage:update",
} as const;

/** Main → renderer runtime broadcast payload. */
export interface RuntimeUpdatePayload {
  key: string;
  newValue: unknown;
  oldValue: unknown;
}

/** Renderer → main storage write payload (single key or partial patch). */
export interface StorageSetPayload {
  name: string;
  patch: Record<string, unknown>;
}

/**
 * Renderer → main initial fetch payload (sendSync). The main process creates
 * the store on first call with these defaults/version/options.
 */
export interface StorageGetPayload {
  defaults: Record<string, unknown>;
  version: number;
  options?: StorageStateOptions;
}

/** Per-key runtime broadcast channel, e.g. `cws:runtime:update:theme`. */
export function runtimeUpdateChannel(key: string): string {
  return `${channel.runtimeUpdate}:${key}`;
}

/**
 * Storage broadcast channel. With a key: `cws:storage:update:{name}:{key}`
 * (what preload/renderer consume). Without: whole-state form reserved for
 * future use.
 */
export function storageUpdateChannel(name: string, key?: string): string {
  return key === undefined
    ? `${channel.storageUpdate}:${name}`
    : `${channel.storageUpdate}:${name}:${key}`;
}
