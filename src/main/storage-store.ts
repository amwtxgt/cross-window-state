/**
 * Main-process persistent store: JSON file + versioned migration + debounced
 * atomic writes, shared with renderer windows over IPC.
 *
 * Design notes (pitfalls hit by the predecessor implementation, fixed here):
 * - Writes are atomic (tmp file + rename) with a direct-write fallback, so a
 *   crash mid-write cannot corrupt the previous state.
 * - Debounced saves run through a drain loop that always serializes the
 *   LATEST data, so a queued save can never overwrite newer state with an
 *   older snapshot.
 * - First creation, migrations and repairs write synchronously — renderers
 *   fetch state via sendSync, so the file must exist before construction
 *   returns. `destroy()` also flushes synchronously (app-quit safe).
 * - A corrupted file falls back to defaults AND is repaired on disk right
 *   away, so the corruption does not linger.
 * - Option defaults use `??` so explicit 0 values are respected.
 */
import { app, webContents } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { storageUpdateChannel } from '../core/protocol'
import { createSignal } from '../core/signal'
import type { Signal } from '../core/signal'
import type { StorageStateOptions } from '../core/types'
import { createProxyState, debounce, deepEqual } from '../core/utils'
import type { DebouncedFunction } from '../core/utils'

const SAVE_DEBOUNCE_MS = 300
const NAME_RE = /^[a-zA-Z0-9_-]+$/

export interface StoredFileShape {
  version: number
  data: Record<string, unknown>
  updatedAt: string
}

interface LoadedState {
  data: Record<string, unknown>
  isNew: boolean
  migrated: boolean
  repaired: boolean
}

export class StorageStore<T extends Record<string, unknown>> {
  /** All live stores by name — same name+version reuses one instance. */
  static instances = new Map<string, StorageStore<Record<string, unknown>>>()

  readonly name: string
  readonly version: number
  // `!` on the fields below: the constructor may early-return the existing
  // instance (singleton dispatch), in which case `this` is discarded and
  // these never get assigned on the throwaway object.
  readonly isNew!: boolean

  private readonly defaults: T
  private readonly data!: Record<string, unknown>
  private readonly filePath!: string
  private readonly maxRetries: number
  private readonly retryDelay: number
  private readonly keySignals = new Map<string, Signal<unknown>>()
  private readonly rootSignal!: Signal<Record<string, unknown>>
  private readonly proxyState!: T
  private debouncedSave!: DebouncedFunction<[]>
  private readonly rendererIds = new Set<number>()
  private dirty = false
  private writeInFlight = false
  private destroyed = false

  constructor(name: string, defaults: T, version: number, options?: StorageStateOptions) {
    if (!NAME_RE.test(name)) {
      throw new Error(`[cws] StorageStore: invalid name "${name}" (must match ${NAME_RE.source})`)
    }
    this.name = name
    this.defaults = { ...defaults }
    this.version = version
    this.maxRetries = options?.maxRetries ?? 3
    this.retryDelay = options?.retryDelay ?? 1000

    const existing = StorageStore.instances.get(name)
    if (existing) {
      if (existing.version === version) {
        if (options?.skipDefaultsCheck || deepEqual(existing.defaults, this.defaults)) {
          return existing as unknown as StorageStore<T>
        }
        throw new Error(
          `[cws] StorageStore("${name}") already exists with different defaults; pass skipDefaultsCheck to reuse anyway.`,
        )
      }
      // version changed → migration rebuild
      existing.destroy()
    }

    const dir = join(app.getPath('userData'), options?.dir ?? 'cross-window-state')
    this.filePath = join(dir, `${name}.json`)

    const loaded = this.load()
    this.data = loaded.data
    this.isNew = loaded.isNew

    this.rootSignal = createSignal<Record<string, unknown>>({ ...this.data }, {
      equality: 'always',
    })
    this.proxyState = createProxyState(
      this.data as T,
      (key) => this.onDataChanged(key),
      (key) => this.onDataChanged(key),
    )
    this.debouncedSave = debounce(() => this.startSaveLoop(), SAVE_DEBOUNCE_MS)

    StorageStore.instances.set(name, this as unknown as StorageStore<Record<string, unknown>>)

    // First creation, migration and repair write synchronously: renderers
    // call get via sendSync, so the file must exist before construction
    // returns.
    if (loaded.isNew || loaded.migrated || loaded.repaired) {
      this.dirty = false
      this.writeSyncNow()
    }
  }

  private load(): LoadedState {
    let stored: StoredFileShape | null = null
    let repaired = false
    try {
      const raw = readFileSyncSafe(this.filePath)
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw)
        if (isStoredShape(parsed)) stored = parsed
        else repaired = true
      }
    } catch {
      repaired = true // unreadable file → start from defaults
    }

    if (!stored) {
      mkdirSync(dirname(this.filePath), { recursive: true })
      return { data: { ...this.defaults }, isNew: true, migrated: false, repaired }
    }

    if (stored.version === this.version) {
      return { data: { ...this.defaults, ...stored.data }, isNew: false, migrated: false, repaired }
    }

    // Version mismatch (upgrade OR downgrade): migrate stored data against
    // the CURRENT defaults — added keys get defaults, removed keys are
    // deleted, type-changed keys reset.
    const next: Record<string, unknown> = { ...stored.data }
    for (const key of Object.keys(this.defaults)) {
      const defaultValue = this.defaults[key]
      if (!(key in next) || typeof next[key] !== typeof defaultValue) {
        next[key] = defaultValue
      }
    }
    for (const key of Object.keys(next)) {
      if (!(key in this.defaults)) delete next[key]
    }
    return { data: next, isNew: false, migrated: true, repaired }
  }

  /** Merged current state. Direct writes (`s.state.k = v`) sync + persist. */
  get state(): T {
    return this.proxyState
  }

  set<K extends keyof T & string>(key: K, value: T[K]): void
  set(patch: Partial<T>): void
  set(keyOrPatch: string | Partial<T>, value?: unknown): void {
    if (typeof keyOrPatch === 'string') {
      this.applyChange(keyOrPatch, value)
    } else {
      for (const [key, val] of Object.entries(keyOrPatch)) {
        this.applyChange(key, val)
      }
    }
  }

  private applyChange(key: string, value: unknown): void {
    this.data[key] = value
    this.onDataChanged(key)
  }

  private onDataChanged(key: string): void {
    this.keySignals.get(key)?.set(this.data[key])
    this.rootSignal.set({ ...this.data })
    this.notifyRenderers(key)
    this.dirty = true
    this.debouncedSave()
  }

  /** Subscribe to one key's changes. Returns an unsubscribe function. */
  watch<K extends keyof T & string>(
    key: K,
    cb: (newValue: T[K], oldValue: T[K] | undefined) => void,
  ): () => void {
    let signal = this.keySignals.get(key)
    if (!signal) {
      signal = createSignal<unknown>(this.data[key], { equality: 'always' })
      this.keySignals.set(key, signal)
    }
    return signal.subscribe(cb as (newVal: unknown, oldVal: unknown) => void)
  }

  /** Subscribe to every change with a full-state snapshot. */
  subscribe(cb: (data: Record<string, unknown>) => void): () => void {
    return this.rootSignal.subscribe((next) => cb(next))
  }

  private serialize(): string {
    return JSON.stringify(
      { version: this.version, data: { ...this.data }, updatedAt: new Date().toISOString() },
      null,
      2,
    )
  }

  /**
   * Drain loop: while writes are in flight, later saves just mark dirty;
   * each iteration serializes the latest data, so a queued write can never
   * clobber newer state with an older snapshot.
   */
  private startSaveLoop(): void {
    if (this.writeInFlight) return
    this.writeInFlight = true
    void (async () => {
      try {
        while (this.dirty) {
          this.dirty = false
          await this.writeWithRetry(this.serialize())
        }
      } catch (err) {
        console.error(`[cws] StorageStore("${this.name}") persist failed:`, err)
        this.dirty = false // give up this round; the next change re-schedules
      } finally {
        this.writeInFlight = false
      }
    })()
  }

  private async writeWithRetry(payload: string): Promise<void> {
    let attempt = 0
    // Total attempts = maxRetries (first try + retries).
    for (;;) {
      try {
        await this.writeOnce(payload)
        return
      } catch (err) {
        if (attempt + 1 >= this.maxRetries) throw err
        attempt++
        await delay(this.retryDelay)
      }
    }
  }

  private async writeOnce(payload: string): Promise<void> {
    const tmp = `${this.filePath}.tmp`
    try {
      await writeFile(tmp, payload, 'utf-8')
      await rename(tmp, this.filePath)
    } catch {
      // rename can fail on some platforms (locks, AV scans): fall back to a
      // direct, non-atomic write rather than losing the save.
      await writeFile(this.filePath, payload, 'utf-8')
    }
  }

  /** Synchronous atomic write for construction and destroy paths. */
  private writeSyncNow(): void {
    const payload = this.serialize()
    const tmp = `${this.filePath}.tmp`
    try {
      writeFileSync(tmp, payload, 'utf-8')
      renameSync(tmp, this.filePath)
    } catch {
      try {
        writeFileSync(this.filePath, payload, 'utf-8')
      } catch (err) {
        console.error(`[cws] StorageStore("${this.name}") initial persist failed:`, err)
        this.dirty = true // retry via the debounced path on next change
      }
    }
  }

  /** Flush pending writes synchronously and drop the instance. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.debouncedSave.cancel()
    if (this.dirty) {
      this.dirty = false
      this.writeSyncNow()
    }
    StorageStore.instances.delete(this.name)
    this.rendererIds.clear()
  }

  // ---- renderer coordination -------------------------------------------

  /** State snapshot for a renderer; registers it for future broadcasts. */
  getByRenderer(senderId: number): Record<string, unknown> {
    this.rendererIds.add(senderId)
    return { ...this.data }
  }

  /** Apply a patch coming from a renderer (same semantics as local set). */
  setByRenderer(patch: Record<string, unknown>, key?: string): void {
    if (key !== undefined) {
      this.applyChange(key, patch[key])
    } else {
      for (const [k, v] of Object.entries(patch)) this.applyChange(k, v)
    }
  }

  /** Broadcast a changed key to registered renderers, pruning dead ones. */
  notifyRenderers(key: string): void {
    if (this.rendererIds.size === 0) return
    const invalid: number[] = []
    for (const id of this.rendererIds) {
      try {
        const wc = webContents.fromId(id)
        if (!wc || wc.isDestroyed()) {
          invalid.push(id)
          continue
        }
        wc.send(storageUpdateChannel(this.name, key), this.data[key])
      } catch {
        invalid.push(id)
      }
    }
    for (const id of invalid) this.rendererIds.delete(id)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readFileSyncSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

function isStoredShape(value: unknown): value is StoredFileShape {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.version === 'number' &&
    typeof v.data === 'object' &&
    v.data !== null &&
    !Array.isArray(v.data)
  )
}
