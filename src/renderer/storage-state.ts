/**
 * `createStorageState` for renderer windows. Same name/signature/semantics
 * as the main-process factory (locked by the contract suite).
 *
 * `.state` is a writable Proxy over the merged data: `s.state.k = v` and
 * `delete s.state.k` go through the sync pipeline automatically (same
 * core `createProxyState` the main-process StorageStore uses).
 *
 * Key subscriptions are established for every defaults key and lazily for
 * any key passed to `.watch()` — a key this page never declared cannot
 * arrive as a cross-window update it would know how to interpret.
 */
import type { StorageStateOptions } from '../core/types'
import { createProxyState } from '../core/utils'
import { bridge } from './bridge'

export interface StorageState<T extends Record<string, unknown>> {
  /** Merged state; direct writes and deletes sync + persist automatically. */
  readonly state: T
  set<K extends keyof T & string>(key: K, value: T[K]): void
  set(patch: Partial<T>): void
  /** Subscribe to one key's changes. Returns an unsubscribe function. */
  watch<K extends keyof T & string>(
    key: K,
    cb: (newValue: T[K], oldValue: T[K] | undefined) => void,
  ): () => void
  /** Unsubscribe from the bus. Later operations are rejected. */
  destroy(): void
}

interface CacheEntry {
  version: number
  state: StorageState<Record<string, unknown>>
}

const cache = new Map<string, CacheEntry>()

export function createStorageState<T extends Record<string, unknown>>(
  name: string,
  defaults: T,
  version: number,
  options?: StorageStateOptions,
): StorageState<T> {
  const existing = cache.get(name)
  if (existing && existing.version === version) {
    return existing.state as StorageState<T>
  }
  if (existing) {
    // version changed: rebuild (mirrors the main-process migration rebuild)
    existing.state.destroy()
  }

  // null defense: the main process returns null when the store exists with
  // different defaults/version config — fall back to our own defaults
  let raw: Record<string, unknown>
  const fetched = bridge.storage.get(name, { defaults, version, options })
  if (fetched === null || typeof fetched !== 'object') {
    raw = { ...defaults }
  } else {
    raw = fetched
  }
  const data: Record<string, unknown> = raw

  let destroyed = false
  const keyWatchers = new Map<string, Set<(value: unknown) => void>>()
  const keySubs = new Map<string, () => void>()

  function notifyKey(key: string): void {
    const watchers = keyWatchers.get(key)
    if (!watchers) return
    for (const cb of [...watchers]) cb(data[key])
  }

  function ensureSubscribed(key: string): void {
    if (keySubs.has(key)) return
    const off = bridge.storage.onStateUpdated(name, key, (value) => {
      if (destroyed) return
      if (Object.is(value, data[key])) return
      data[key] = value
      notifyKey(key)
    })
    keySubs.set(key, off)
  }

  // defaults keys respond to cross-window updates out of the box
  for (const key of Object.keys(defaults)) ensureSubscribed(key)

  function applyLocalChange(key: string, deleteKey: boolean): void {
    if (destroyed) {
      console.error(`[cws] StorageState("${name}") was destroyed; write is ignored.`)
      return
    }
    ensureSubscribed(key)
    if (deleteKey) {
      delete data[key]
      bridge.storage.set(name, { [key]: undefined }, key)
    } else {
      bridge.storage.set(name, { [key]: data[key] }, key)
    }
    notifyKey(key)
  }

  const proxy = createProxyState(
    data,
    (key) => applyLocalChange(key, false),
    (key) => applyLocalChange(key, true),
  )

  const state: StorageState<T> = {
    get state() {
      return proxy as T
    },
    set(keyOrPatch: string | Partial<T>, value?: unknown): void {
      if (typeof keyOrPatch === 'string') {
        data[keyOrPatch] = value
        applyLocalChange(keyOrPatch, false)
      } else {
        for (const [key, val] of Object.entries(keyOrPatch)) {
          data[key] = val
          applyLocalChange(key, false)
        }
      }
    },
    watch(key, cb) {
      if (destroyed) {
        console.error(`[cws] StorageState("${name}") was destroyed; watch() is ignored.`)
        return () => {}
      }
      ensureSubscribed(key)
      let watchers = keyWatchers.get(key)
      if (!watchers) {
        watchers = new Set()
        keyWatchers.set(key, watchers)
      }
      const wrapped = cb as (value: unknown) => void
      watchers.add(wrapped)
      return () => {
        watchers.delete(wrapped)
      }
    },
    destroy() {
      if (destroyed) {
        console.error(`[cws] StorageState("${name}") is already destroyed.`)
        return
      }
      destroyed = true
      for (const off of keySubs.values()) off()
      keySubs.clear()
      keyWatchers.clear()
      if (cache.get(name)?.state === (state as StorageState<Record<string, unknown>>)) {
        cache.delete(name)
      }
    },
  }

  cache.set(name, { version, state: state as StorageState<Record<string, unknown>> })
  return state
}
