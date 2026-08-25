/**
 * Main-process singleton that owns every runtime state, broadcasts updates
 * to subscribed renderers, and garbage-collects states once neither the main
 * process nor any renderer holds a reference.
 *
 * Reference counting rules:
 * - `acquire` (main process) bumps a per-name counter; `release` drops it.
 * - A renderer is auto-registered by its first `cws:runtime:get` and
 *   unregistered by `cws:runtime:clear` (sent on state destroy) or when its
 *   webContents dies.
 * - When both counts reach zero the state entry is deleted for real — no
 *   zombie entries for get-only keys that were never set.
 */
import { app, ipcMain, webContents } from 'electron'
import { channel, runtimeUpdateChannel } from '../core/protocol'
import type { RuntimeUpdatePayload } from '../core/protocol'
import { createSignal } from '../core/signal'
import type { Signal } from '../core/signal'

export class RuntimeStateManager {
  private states = new Map<string, Signal<unknown>>()
  private rendererIds = new Map<string, number[]>()
  private mainRefs = new Map<string, number>()

  constructor() {
    void app.whenReady().then(() => this.setupIpc())
  }

  private setupIpc(): void {
    ipcMain.on(channel.runtimeGet, (event, key: string) => {
      this.registerRenderer(key, event.sender.id)
      event.returnValue = this.states.get(key)?.value
    })
    ipcMain.on(channel.runtimeSet, (_event, key: string, value: unknown) => {
      this.set(key, value)
    })
    ipcMain.on(channel.runtimeClear, (event, key: string) => {
      this.unregisterRenderer(key, event.sender.id)
    })
  }

  /**
   * Main-process acquire: bump the ref count. The first acquire creates the
   * signal with `defaultValue`; later acquires reuse the live value.
   */
  acquire<T>(name: string, defaultValue?: T): Signal<T> {
    let signal = this.states.get(name)
    if (!signal) {
      signal = createSignal<T>(defaultValue as T)
      this.states.set(name, signal)
    }
    this.mainRefs.set(name, (this.mainRefs.get(name) ?? 0) + 1)
    return signal as Signal<T>
  }

  /** Main-process release. When the last ref drops, the state may be freed. */
  release(name: string): void {
    const refs = (this.mainRefs.get(name) ?? 0) - 1
    if (refs > 0) {
      this.mainRefs.set(name, refs)
      return
    }
    this.mainRefs.delete(name)
    this.maybeCleanup(name)
  }

  /** Current value for `name`, or undefined when absent/cleared. */
  get(name: string): unknown {
    return this.states.get(name)?.value
  }

  /**
   * Set (or create) a state and broadcast to subscribed renderers.
   * `set(name, undefined)` clears the entry but still broadcasts
   * `{ newValue: undefined }` so renderers converge.
   */
  set(name: string, value: unknown): void {
    let signal = this.states.get(name)
    if (!signal) {
      signal = createSignal(value)
      this.states.set(name, signal)
    }
    const oldValue = signal.value
    signal.set(value)
    if (value === undefined) {
      // Clear for real: no zombie entries. Signal holders keep their last
      // value locally until they re-acquire.
      this.states.delete(name)
    }
    this.broadcast(name, { key: name, newValue: value, oldValue })
  }

  private registerRenderer(key: string, senderId: number): void {
    const ids = this.rendererIds.get(key)
    if (!ids) {
      this.rendererIds.set(key, [senderId])
    } else if (!ids.includes(senderId)) {
      ids.push(senderId)
    }
  }

  private unregisterRenderer(key: string, senderId: number): void {
    const ids = this.rendererIds.get(key)
    if (!ids) return
    const next = ids.filter((id) => id !== senderId)
    if (next.length === 0) {
      this.rendererIds.delete(key)
      this.maybeCleanup(key)
    } else {
      this.rendererIds.set(key, next)
    }
  }

  private maybeCleanup(key: string): void {
    const hasMainRef = this.mainRefs.has(key)
    const renderers = this.rendererIds.get(key)
    if (!hasMainRef && (!renderers || renderers.length === 0)) {
      this.states.delete(key)
      this.rendererIds.delete(key)
    }
  }

  private broadcast(key: string, payload: RuntimeUpdatePayload): void {
    const ids = this.rendererIds.get(key)
    if (!ids || ids.length === 0) return
    const invalid: number[] = []
    for (const id of ids) {
      // webContents may be gone or mid-destruction; treat all failures as
      // "drop the subscriber" instead of letting one dead window break the
      // broadcast loop.
      try {
        const wc = webContents.fromId(id)
        if (!wc || wc.isDestroyed()) {
          invalid.push(id)
          continue
        }
        wc.send(runtimeUpdateChannel(key), payload)
      } catch {
        invalid.push(id)
      }
    }
    if (invalid.length > 0) {
      this.rendererIds.set(
        key,
        (this.rendererIds.get(key) ?? []).filter((id) => !invalid.includes(id)),
      )
    }
  }
}

/** Process-wide singleton used by `createRuntimeState` (main). */
export const runtimeStateManager = new RuntimeStateManager()
