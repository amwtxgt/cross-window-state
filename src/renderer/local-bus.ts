/**
 * Web-mode bus: what renderer states talk to when `window.__crossWindowState__`
 * is absent (pure browser, no Electron preload).
 *
 * - runtime state lives in memory only; cross-tab delivery via BroadcastChannel
 * - storage state persists to localStorage under `cws:{name}` as
 *   `{version, data}` and syncs cross-tab as patches
 * - the bus channel is created at module load, BEFORE any state is created:
 *   BroadcastChannel has no replay, so a lazy channel would make a
 *   subscribe-only tab miss every broadcast sent before its first set
 * - semantic alignment with Electron mode: set() notifies the local page
 *   synchronously (the main process broadcasts to every window including
 *   the writer), and clear() is local-only — one tab closing must not wipe
 *   the value for other tabs (mirrors main-process ref counting)
 */

interface RuntimeEntry {
  value: unknown
  listeners: Set<(value: unknown) => void>
}

interface StorageEntry {
  version: number
  data: Record<string, unknown>
  keyListeners: Map<string, Set<(value: unknown) => void>>
}

interface BusMessage {
  kind: 'runtime' | 'storage'
  name: string
  value?: unknown
  patch?: Record<string, unknown>
}

const BUS_CHANNEL = 'cws:bus'
const STORAGE_PREFIX = 'cws:'

const runtimeEntries = new Map<string, RuntimeEntry>()
const storageEntries = new Map<string, StorageEntry>()

// tri-state: undefined = not attempted, null = unsupported, channel = live
let busChannel: BroadcastChannel | null | undefined

function getBusChannel(): BroadcastChannel | null {
  if (busChannel !== undefined) return busChannel
  try {
    const ch = new BroadcastChannel(BUS_CHANNEL)
    ch.onmessage = (event: MessageEvent) => {
      applyBusMessage(event.data)
    }
    busChannel = ch
  } catch {
    busChannel = null // no BroadcastChannel: degrade to single-tab
  }
  return busChannel
}

function postBus(message: BusMessage): void {
  const ch = getBusChannel()
  if (ch) {
    try {
      ch.postMessage(message)
    } catch {
      // structured clone failure for exotic values: local page still synced
    }
  }
}

// Create the channel eagerly unless an Electron preload bridge exists —
// a subscribe-only tab must not miss broadcasts sent before its first set.
if (typeof window === 'undefined' || typeof window.__crossWindowState__ === 'undefined') {
  getBusChannel()
}

function applyBusMessage(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const msg = raw as Partial<BusMessage>
  if (msg.kind === 'runtime' && typeof msg.name === 'string') {
    applyRuntime(msg.name, msg.value)
  } else if (
    msg.kind === 'storage' &&
    typeof msg.name === 'string' &&
    typeof msg.patch === 'object' &&
    msg.patch !== null
  ) {
    applyStoragePatch(msg.name, msg.patch)
  }
}

// ---- runtime ----------------------------------------------------------

function runtimeEntryOf(key: string): RuntimeEntry {
  let entry = runtimeEntries.get(key)
  if (!entry) {
    entry = { value: undefined, listeners: new Set() }
    runtimeEntries.set(key, entry)
  }
  return entry
}

function applyRuntime(key: string, value: unknown): void {
  const entry = runtimeEntryOf(key)
  entry.value = value
  for (const cb of [...entry.listeners]) cb(value)
}

export const localRuntimeBus = {
  get(key: string): unknown {
    return runtimeEntries.get(key)?.value
  },
  set(key: string, value: unknown): void {
    applyRuntime(key, value) // local page first (channel does not echo)
    postBus({ kind: 'runtime', name: key, value })
  },
  /** Local-page teardown only: notify own listeners with undefined, drop the
   *  entry. Never broadcast — other tabs keep their state. */
  clear(key: string): void {
    const entry = runtimeEntries.get(key)
    if (!entry) return
    for (const cb of [...entry.listeners]) cb(undefined)
    runtimeEntries.delete(key)
  },
  onStateUpdated(key: string, cb: (value: unknown) => void): () => void {
    const entry = runtimeEntryOf(key)
    entry.listeners.add(cb)
    return () => {
      entry.listeners.delete(cb)
    }
  },
}

// ---- storage ----------------------------------------------------------

interface PersistedShape {
  version: number
  data: Record<string, unknown>
}

function readPersisted(name: string): PersistedShape | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + name)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as PersistedShape).version !== 'number' ||
      typeof (parsed as PersistedShape).data !== 'object' ||
      (parsed as PersistedShape).data === null
    ) {
      return null
    }
    return parsed as PersistedShape
  } catch {
    return null
  }
}

function persistEntry(name: string, entry: StorageEntry): void {
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + name,
      JSON.stringify({ version: entry.version, data: entry.data }),
    )
  } catch {
    // quota exceeded / private mode: keep memory state as source of truth
  }
}

function storageEntryOf(name: string): StorageEntry {
  let entry = storageEntries.get(name)
  if (!entry) {
    // Restore from localStorage keeping the WRITER's version — a broadcast
    // can arrive before this tab ever calls get(); losing the version here
    // would make subsequent reads mismatch and silently reset data.
    const persisted = readPersisted(name)
    entry = {
      version: persisted?.version ?? 0,
      data: { ...(persisted?.data ?? {}) },
      keyListeners: new Map(),
    }
    storageEntries.set(name, entry)
  }
  return entry
}

function notifyStorageKey(entry: StorageEntry, key: string): void {
  const listeners = entry.keyListeners.get(key)
  if (!listeners) return
  for (const cb of [...listeners]) cb(entry.data[key])
}

function applyStoragePatch(name: string, patch: Record<string, unknown>): void {
  const entry = storageEntryOf(name)
  entry.data = { ...entry.data, ...patch }
  persistEntry(name, entry)
  for (const key of Object.keys(patch)) notifyStorageKey(entry, key)
}

export const localStorageBus = {
  /**
   * Merge persisted data over defaults when versions match; on mismatch,
   * fall back to defaults and repair the disk with the new version (the web
   * mode has no migration chain — there is no main process to run one).
   */
  get(
    name: string,
    options: { defaults: Record<string, unknown>; version: number },
  ): Record<string, unknown> {
    const persisted = readPersisted(name)
    if (persisted && persisted.version === options.version) {
      const data = { ...options.defaults, ...persisted.data }
      const entry = storageEntryOf(name)
      entry.version = options.version
      entry.data = { ...data }
      return { ...data }
    }
    const data = { ...options.defaults }
    const entry = storageEntryOf(name)
    entry.version = options.version
    entry.data = { ...data }
    persistEntry(name, entry)
    return { ...data }
  },
  set(name: string, patch: Record<string, unknown>, key?: string): void {
    const normalized = key !== undefined ? { [key]: patch[key] } : { ...patch }
    applyStoragePatch(name, normalized) // local page first
    postBus({ kind: 'storage', name, patch: normalized })
  },
  onStateUpdated(name: string, key: string, cb: (value: unknown) => void): () => void {
    const entry = storageEntryOf(name)
    let listeners = entry.keyListeners.get(key)
    if (!listeners) {
      listeners = new Set()
      entry.keyListeners.set(key, listeners)
    }
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  },
}
