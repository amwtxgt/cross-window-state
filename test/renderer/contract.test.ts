import { beforeEach, vi } from 'vitest'
import { makeFakeBridge } from './helpers/fake-bridge'
import { runStateApiContractSuite } from '../contract/state-api.contract'
import type { ContractFactories } from '../contract/state-api.contract'
import type * as RendererModule from '../../src/renderer/index'

vi.stubGlobal('BroadcastChannel', class {
  static instances = new Set()
  onmessage: unknown = null
  close(): void {}
  postMessage(): void {}
})

let mod: typeof RendererModule

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  const fake = makeFakeBridge()
  ;(window as unknown as Record<string, unknown>).__crossWindowState__ = fake.bridge
  mod = await import('../../src/renderer/index')
})

runStateApiContractSuite('renderer', () => {
  const f = mod as unknown as ContractFactories & typeof mod
  return {
    createRuntimeState: f.createRuntimeState,
    createStorageState: f.createStorageState,
  }
})
