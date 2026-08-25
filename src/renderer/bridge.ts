/**
 * Host detection: pick the Electron preload bridge when present, otherwise
 * fall back to the web-mode local bus. Evaluated once at module load — the
 * preload injects `window.__crossWindowState__` before any page script runs,
 * so the choice is stable for the page lifetime.
 *
 * Both bus shapes satisfy the same interfaces; the payload protocol is
 * identical (runtime updates arrive as {key,newValue,oldValue}, storage
 * updates as bare values on a key-level channel).
 */
import { localRuntimeBus, localStorageBus } from "./local-bus";
import type { RuntimeUpdatePayload, StorageGetPayload } from "../core/protocol";

export interface RuntimeBus {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  clear(key: string): void;
  onStateUpdated(key: string, cb: (payload: RuntimeUpdatePayload) => void): () => void;
}

export interface StorageBus {
  get(name: string, payload: StorageGetPayload): Record<string, unknown> | null;
  set(name: string, patch: Record<string, unknown>, key?: string): void;
  onStateUpdated(name: string, key: string, cb: (value: unknown) => void): () => void;
}

function detect(): { runtime: RuntimeBus; storage: StorageBus } {
  if (typeof window !== "undefined" && window.__crossWindowState__) {
    return window.__crossWindowState__;
  }
  return { runtime: localRuntimeBus, storage: localStorageBus };
}

export const bridge = detect();
