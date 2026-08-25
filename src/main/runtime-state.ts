/**
 * `createRuntimeState` for the main process. Same name/signature/semantics
 * as the renderer factory — the north-star "zero-difference DX" contract.
 * IPC fan-out and reference counting are handled by RuntimeStateManager.
 */
import type { RuntimeStateOptions } from '../core/types'
import { runtimeStateManager } from './runtime-manager'

export interface RuntimeState<T> {
  /** Current value. */
  readonly state: T
  /** Write a new value; propagates to every window sharing this state. */
  set(value: T): void
  /**
   * Subscribe to changes (local sets, other-window sets, main-process sets).
   * Returns an unsubscribe function.
   */
  watch(cb: (newVal: T, oldVal: T | undefined) => void): () => void
  /**
   * Release this handle. Once every handle (main + windows) is destroyed,
   * the underlying state is garbage-collected. Later operations are
   * rejected with a console error.
   */
  destroy(): void
}

export function createRuntimeState<T>(
  name: string,
  defaultValue?: T,
  options?: RuntimeStateOptions,
): RuntimeState<T> {
  const signal = runtimeStateManager.acquire<T>(name, defaultValue)
  let destroyed = false
  const offs: Array<() => void> = []

  return {
    get state() {
      return signal.value
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
      runtimeStateManager.set(name, value)
    },
    watch(cb) {
      if (destroyed) {
        console.error(`[cws] RuntimeState("${name}") was destroyed; watch() is ignored.`)
        return () => {}
      }
      const off = signal.subscribe(cb)
      offs.push(off)
      return off
    },
    destroy() {
      if (destroyed) {
        console.error(`[cws] RuntimeState("${name}") is already destroyed.`)
        return
      }
      destroyed = true
      for (const off of offs) off()
      offs.length = 0
      runtimeStateManager.release(name)
    },
  }
}
