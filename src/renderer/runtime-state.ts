/**
 * `createRuntimeState` for renderer windows. Same name/signature/semantics
 * as the main-process factory (locked by the contract suite).
 *
 * - `.set()` updates local state optimistically, then propagates through the
 *   bus; the arriving broadcast is de-duplicated via Object.is, so watchers
 *   fire exactly once per change on the writing page too.
 * - instances are cached per name: two creations on one page share a single
 *   handle and one bus subscription.
 */
import type { RuntimeStateOptions } from '../core/types'
import { bridge } from './bridge'

export interface RuntimeState<T> {
  /** Current value. */
  readonly state: T
  /** Write a new value; propagates to the main process and every window. */
  set(value: T): void
  /** Subscribe to changes. Returns an unsubscribe function. */
  watch(cb: (newVal: T, oldVal: T | undefined) => void): () => void
  /** Unsubscribe and release. Later set/watch calls are rejected. */
  destroy(): void
}

const cache = new Map<string, RuntimeState<unknown>>()

export function createRuntimeState<T>(
  name: string,
  defaultValue?: T,
  options?: RuntimeStateOptions,
): RuntimeState<T> {
  const existing = cache.get(name)
  if (existing) return existing as RuntimeState<T>

  let current = (bridge.runtime.get(name) ?? defaultValue) as T
  let destroyed = false
  const watchers = new Set<(newVal: T, oldVal: T | undefined) => void>()

  const offBridge = bridge.runtime.onStateUpdated(name, ({ newValue }) => {
    if (destroyed) return
    if (Object.is(newValue, current)) return
    const old = current
    current = newValue as T
    for (const cb of [...watchers]) cb(current, old)
  })

  const state: RuntimeState<T> = {
    get state() {
      return current
    },
    set(value) {
      if (destroyed) {
        console.error(`[cws] RuntimeState("${name}") was destroyed; set() is ignored.`)
        return
      }
      if (options?.readonly) {
        console.error(`[cws] RuntimeState("${name}") is readonly; set() is rejected.`)
        return
      }
      const old = current
      current = value
      bridge.runtime.set(name, value)
      for (const cb of [...watchers]) cb(value, old)
    },
    watch(cb) {
      if (destroyed) {
        console.error(`[cws] RuntimeState("${name}") was destroyed; watch() is ignored.`)
        return () => {}
      }
      watchers.add(cb)
      return () => {
        watchers.delete(cb)
      }
    },
    destroy() {
      if (destroyed) {
        console.error(`[cws] RuntimeState("${name}") is already destroyed.`)
        return
      }
      destroyed = true
      watchers.clear()
      offBridge()
      cache.delete(name)
      // Web mode: local unsubscribe only (sibling tabs keep the value).
      // Electron mode: releases this window's registration; the main
      // process garbage-collects when every holder is gone.
      bridge.runtime.clear(name)
    },
  }

  cache.set(name, state as RuntimeState<unknown>)
  return state
}
