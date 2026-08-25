import { vi } from 'vitest'
import type { Mock } from 'vitest'

type RuntimeHandler = (payload: { key: string; newValue: unknown; oldValue: unknown }) => void
type StorageHandler = (value: unknown) => void

export interface FakeRuntimeBus {
  get: Mock
  set: Mock
  clear: Mock
  onStateUpdated: Mock
}

export interface FakeStorageBus {
  get: Mock
  set: Mock
  onStateUpdated: Mock
}

/**
 * In-memory fake of the preload bridge: window.__crossWindowState__.
 * `emit*` helpers simulate main-process broadcasts; spies record what the
 * renderer states send.
 */
export function makeFakeBridge(): {
  bridge: { runtime: FakeRuntimeBus; storage: FakeStorageBus }
  emitRuntime(key: string, newValue: unknown, oldValue?: unknown): void
  emitStorage(name: string, key: string, value: unknown): void
  runtimeValues: Map<string, unknown>
  storageStates: Map<string, Record<string, unknown>>
} {
  const runtimeValues = new Map<string, unknown>()
  const storageStates = new Map<string, Record<string, unknown>>()
  const runtimeHandlers = new Map<string, Set<RuntimeHandler>>()
  const storageHandlers = new Map<string, Set<StorageHandler>>()

  const bridge = {
    runtime: {
      get: vi.fn((key: string) => runtimeValues.get(key)),
      set: vi.fn((key: string, value: unknown) => {
        runtimeValues.set(key, value)
      }),
      clear: vi.fn(),
      onStateUpdated: vi.fn((key: string, cb: RuntimeHandler) => {
        let set = runtimeHandlers.get(key)
        if (!set) {
          set = new Set()
          runtimeHandlers.set(key, set)
        }
        set.add(cb)
        return () => {
          set.delete(cb)
        }
      }),
    },
    storage: {
      get: vi.fn((name: string, payload: { defaults: Record<string, unknown> }) => {
        const persisted = storageStates.get(name)
        if (persisted) return { ...payload.defaults, ...persisted }
        return { ...payload.defaults }
      }),
      set: vi.fn((name: string, patch: Record<string, unknown>) => {
        let state = storageStates.get(name)
        if (!state) {
          state = {}
          storageStates.set(name, state)
        }
        Object.assign(state, patch)
      }),
      onStateUpdated: vi.fn((name: string, key: string, cb: StorageHandler) => {
        const ch = `${name}:${key}`
        let set = storageHandlers.get(ch)
        if (!set) {
          set = new Set()
          storageHandlers.set(ch, set)
        }
        set.add(cb)
        return () => {
          set.delete(cb)
        }
      }),
    },
  }

  function emitRuntime(key: string, newValue: unknown, oldValue?: unknown): void {
    for (const cb of runtimeHandlers.get(key) ?? []) {
      cb({ key, newValue, oldValue })
    }
  }

  function emitStorage(name: string, key: string, value: unknown): void {
    for (const cb of storageHandlers.get(`${name}:${key}`) ?? []) cb(value)
  }

  return { bridge, emitRuntime, emitStorage, runtimeValues, storageStates }
}

export type FakeBridge = ReturnType<typeof makeFakeBridge>
