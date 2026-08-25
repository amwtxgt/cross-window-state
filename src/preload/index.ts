/**
 * Preload bridge — load with `require('cross-window-state/preload')` (a
 * single .cjs file, since sandboxed preloads do not support ESM).
 *
 * Exposes `window.__crossWindowState__` with `runtime` and `storage` faces.
 *
 * Unsubscribe discipline: every on* wrapper is kept in a local variable and
 * the SAME reference is passed to `ipcRenderer.off`. The predecessor library
 * passed the raw user callback to off(), which matched nothing — listeners
 * leaked forever. Covered by regression tests.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { channel, runtimeUpdateChannel, storageUpdateChannel } from '../core/protocol'
import type { RuntimeUpdatePayload, StorageGetPayload } from '../core/protocol'

export interface CrossWindowStateBridge {
  runtime: {
    get(key: string): unknown
    set(key: string, value: unknown): void
    clear(key: string): void
    onStateUpdated(key: string, cb: (payload: RuntimeUpdatePayload) => void): () => void
  }
  storage: {
    get(name: string, payload: StorageGetPayload): Record<string, unknown> | null
    set(name: string, patch: Record<string, unknown>, key?: string): void
    onStateUpdated(name: string, key: string, cb: (value: unknown) => void): () => void
  }
}

const bridge: CrossWindowStateBridge = {
  runtime: {
    get(key) {
      return ipcRenderer.sendSync(channel.runtimeGet, key)
    },
    set(key, value) {
      ipcRenderer.send(channel.runtimeSet, key, value)
    },
    clear(key) {
      ipcRenderer.send(channel.runtimeClear, key)
    },
    onStateUpdated(key, cb) {
      const ch = runtimeUpdateChannel(key)
      const wrapped = (_event: unknown, payload: RuntimeUpdatePayload): void => cb(payload)
      ipcRenderer.on(ch, wrapped)
      return () => {
        ipcRenderer.off(ch, wrapped)
      }
    },
  },
  storage: {
    get(name, payload) {
      return ipcRenderer.sendSync(channel.storageGet, name, payload) as
        | Record<string, unknown>
        | null
    },
    set(name, patch, key) {
      ipcRenderer.send(channel.storageSet, name, patch, key)
    },
    onStateUpdated(name, key, cb) {
      const ch = storageUpdateChannel(name, key)
      const wrapped = (_event: unknown, value: unknown): void => cb(value)
      ipcRenderer.on(ch, wrapped)
      return () => {
        ipcRenderer.off(ch, wrapped)
      }
    },
  },
}

contextBridge.exposeInMainWorld('__crossWindowState__', bridge)
