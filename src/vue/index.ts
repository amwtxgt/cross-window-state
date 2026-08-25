/**
 * Vue bridge: `useRuntimeState` / `useStorageState` — shallowRef views over
 * the renderer states so templates update automatically. `vue` is an
 * optional peer dependency; only import this entry from Vue apps.
 *
 * Scope lifecycle: disposal only unsubscribes THIS composable's watcher —
 * it never destroys the underlying state, which is shared by name across
 * every consumer on the page.
 */
import { onScopeDispose, shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import { createRuntimeState } from '../renderer/runtime-state'
import type { RuntimeState } from '../renderer/runtime-state'
import { createStorageState } from '../renderer/storage-state'
import type { StorageState } from '../renderer/storage-state'
import type { RuntimeStateOptions, StorageStateOptions } from '../core/types'

export interface UseRuntimeState<T> {
  /** Reactive snapshot of the value; use in templates. */
  state: ShallowRef<T>
  set(value: T): void
  watch(cb: (newVal: T, oldVal: T | undefined) => void): () => void
}

export function useRuntimeState<T>(
  name: string,
  defaultValue?: T,
  options?: RuntimeStateOptions,
): UseRuntimeState<T> {
  const runtimeState: RuntimeState<T> = createRuntimeState(name, defaultValue, options)
  const ref = shallowRef<T>(runtimeState.state)
  const off = runtimeState.watch((v) => {
    ref.value = v
  })
  onScopeDispose(() => {
    off()
  })
  return {
    state: ref,
    set: (value: T) => runtimeState.set(value),
    watch: (cb: (newVal: T, oldVal: T | undefined) => void) => runtimeState.watch(cb),
  }
}

export interface UseStorageState<T extends Record<string, unknown>> {
  /** Reactive snapshot refreshed on any watched key change. */
  state: ShallowRef<Record<string, unknown>>
  /** Writable proxy — `proxy.k = v` syncs + persists and refreshes `state`. */
  proxy: T
  set<K extends keyof T & string>(key: K, value: T[K]): void
  set(patch: Partial<T>): void
  watch<K extends keyof T & string>(
    key: K,
    cb: (newValue: T[K], oldValue: T[K] | undefined) => void,
  ): () => void
}

export function useStorageState<T extends Record<string, unknown>>(
  name: string,
  defaults: T,
  version: number,
  options?: StorageStateOptions,
): UseStorageState<T> {
  const storageState: StorageState<T> = createStorageState(name, defaults, version, options)
  const ref = shallowRef<Record<string, unknown>>({ ...storageState.state })
  const refresh = (): void => {
    ref.value = { ...storageState.state }
  }
  // defaults keys refresh the snapshot; cross-window updates and proxy
  // writes both funnel into these key watchers
  const offs = Object.keys(defaults).map((key) => storageState.watch(key, refresh))
  onScopeDispose(() => {
    for (const off of offs) off()
  })
  return {
    state: ref,
    proxy: storageState.state,
    set: (keyOrPatch: string | Partial<T>, value?: unknown) => {
      if (typeof keyOrPatch === 'string') storageState.set(keyOrPatch, value as never)
      else storageState.set(keyOrPatch)
    },
    watch: ((key: string, cb: (newValue: unknown, oldValue: unknown) => void) =>
      storageState.watch(key, cb as never)) as UseStorageState<T>['watch'],
  }
}
