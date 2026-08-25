import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeBridge } from './helpers/fake-bridge'
import type { FakeBridge } from './helpers/fake-bridge'

vi.stubGlobal('BroadcastChannel', class {
  onmessage: unknown = null
  close(): void {}
  postMessage(): void {}
})

let fake: FakeBridge
let mod: typeof import('../../src/renderer/storage-state')

beforeEach(async () => {
  vi.resetModules()
  fake = makeFakeBridge()
  ;(window as unknown as Record<string, unknown>).__crossWindowState__ = fake.bridge
  mod = await import('../../src/renderer/storage-state')
})

describe('renderer StorageState (Electron bridge)', () => {
  it('construction fetches merged state from the bridge with defaults+version', () => {
    fake.storageStates.set('settings', { theme: 'dark' })
    const settings = mod.createStorageState('settings', { theme: 'light', lang: 'en' }, 3)
    expect(fake.bridge.storage.get).toHaveBeenCalledWith('settings', {
      defaults: { theme: 'light', lang: 'en' },
      version: 3,
      options: undefined,
    })
    expect(settings.state.theme).toBe('dark')
    expect(settings.state.lang).toBe('en')
  })

  it('bridge get returning null (config conflict) falls back to defaults', () => {
    fake.bridge.storage.get.mockReturnValueOnce(null)
    const settings = mod.createStorageState('settings', { theme: 'light' }, 1)
    expect(settings.state.theme).toBe('light')
  })

  it('set(key, value) and set(patch) propagate through the bridge', () => {
    const settings = mod.createStorageState('settings', { a: 1, b: 2 }, 1)
    settings.set('a', 10)
    expect(fake.bridge.storage.set).toHaveBeenCalledWith('settings', { a: 10 }, 'a')
    settings.set({ b: 20 })
    expect(fake.bridge.storage.set).toHaveBeenCalledWith('settings', { b: 20 }, 'b')
    expect(settings.state.a).toBe(10)
    expect(settings.state.b).toBe(20)
  })

  it('proxy write state.k = v syncs through the bridge with the key form', () => {
    const settings = mod.createStorageState('settings', { theme: 'light' }, 1)
    settings.state.theme = 'dark'
    expect(fake.bridge.storage.set).toHaveBeenCalledWith('settings', { theme: 'dark' }, 'theme')
    expect(settings.state.theme).toBe('dark')
  })

  it('delete state.k propagates an undefined patch and reads back undefined', () => {
    const settings = mod.createStorageState('settings', { theme: 'light' } as Record<string, unknown>, 1)
    delete settings.state.theme
    expect(fake.bridge.storage.set).toHaveBeenCalledWith('settings', { theme: undefined }, 'theme')
    expect(settings.state.theme).toBeUndefined()
  })

  it('watch(key) fires when the bridge broadcasts that key', () => {
    const settings = mod.createStorageState('settings', { theme: 'light' }, 1)
    const seen: string[] = []
    settings.watch('theme', (v) => seen.push(v as string))

    fake.emitStorage('settings', 'theme', 'dark')
    expect(seen).toEqual(['dark'])
    expect(settings.state.theme).toBe('dark')
  })

  it('watch on a non-defaults key subscribes lazily and receives broadcasts', () => {
    const settings = mod.createStorageState('settings', { a: 1 } as Record<string, unknown>, 1)
    const seen: unknown[] = []
    settings.watch('extra', (v) => seen.push(v))
    fake.emitStorage('settings', 'extra', 42)
    expect(seen).toEqual([42])
    expect(settings.state.extra).toBe(42)
  })

  it('destroy rejects later set and proxy writes; cache is cleared', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const settings = mod.createStorageState('settings', { theme: 'light' }, 1)
    settings.destroy()

    const setCallsBefore = fake.bridge.storage.set.mock.calls.length
    settings.set('theme', 'dark')
    settings.state.theme = 'blue'
    expect(fake.bridge.storage.set.mock.calls.length).toBe(setCallsBefore)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()

    const rebuilt = mod.createStorageState('settings', { theme: 'light' }, 1)
    expect(rebuilt).not.toBe(settings)
  })

  it('same name + version reuses the cached instance', () => {
    const a = mod.createStorageState('settings', { x: 1 }, 1)
    const b = mod.createStorageState('settings', { x: 1 }, 1)
    expect(b).toBe(a)
  })
})
