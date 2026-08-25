import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeBridge } from './helpers/fake-bridge'
import type { FakeBridge } from './helpers/fake-bridge'

vi.stubGlobal('BroadcastChannel', class {
  onmessage: unknown = null
  close(): void {}
  postMessage(): void {}
})

let fake: FakeBridge
let mod: typeof import('../../src/renderer/runtime-state')

beforeEach(async () => {
  vi.resetModules()
  fake = makeFakeBridge()
  ;(window as unknown as Record<string, unknown>).__crossWindowState__ = fake.bridge
  mod = await import('../../src/renderer/runtime-state')
})

describe('renderer RuntimeState (Electron bridge)', () => {
  it('initial state reads the current bridge value, falling back to the default', () => {
    fake.runtimeValues.set('theme', 'dark')
    const existing = mod.createRuntimeState('theme', 'light')
    expect(existing.state).toBe('dark')

    const fresh = mod.createRuntimeState('other', 'light')
    expect(fresh.state).toBe('light')
  })

  it('set propagates through the bridge and updates local state immediately', () => {
    const theme = mod.createRuntimeState('theme', 'light')
    theme.set('dark')
    expect(fake.bridge.runtime.set).toHaveBeenCalledWith('theme', 'dark')
    expect(theme.state).toBe('dark')
  })

  it('bridge broadcast updates state and fires watch; the writing page does not double-fire', () => {
    const theme = mod.createRuntimeState('theme', 'light')
    const seen: string[] = []
    theme.watch((v) => seen.push(v))

    fake.emitRuntime('theme', 'dark', 'light')
    expect(theme.state).toBe('dark')
    expect(seen).toEqual(['dark'])

    // echo of our own set arrives with the same value → no duplicate notify
    fake.emitRuntime('theme', 'dark', 'light')
    expect(seen).toEqual(['dark'])
  })

  it('readonly rejects set via console.error and does not touch the bridge', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const theme = mod.createRuntimeState('theme', 'light', { readonly: true })
    theme.set('dark')
    expect(theme.state).toBe('light')
    expect(fake.bridge.runtime.set).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('destroy unsubscribes from the bridge and clears the name cache', () => {
    const theme = mod.createRuntimeState('theme', 'light')
    theme.destroy()
    expect(fake.bridge.runtime.clear).toHaveBeenCalledWith('theme')

    // a fresh create after destroy works again
    const again = mod.createRuntimeState('theme', 'blue')
    expect(again.state).toBe('blue')
  })

  it('destroy rejects set/watch and warns on double destroy', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const theme = mod.createRuntimeState('theme', 'light')
    theme.destroy()

    theme.set('dark')
    expect(theme.state).toBe('light')
    theme.watch(() => {})
    theme.destroy()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('same-name create returns the cached instance (one bridge subscription)', () => {
    const a = mod.createRuntimeState('theme', 'light')
    const b = mod.createRuntimeState('theme', 'light')
    expect(b).toBe(a)
  })
})
