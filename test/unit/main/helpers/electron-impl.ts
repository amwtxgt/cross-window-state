/**
 * Shared electron mock for main-process unit tests.
 *
 * Usage in a test file:
 *   vi.mock('electron', async () => {
 *     const m = await import('./helpers/electron-impl')
 *     return { ...m.electronMock }
 *   })
 *
 * Mock state lives on `globalThis` so it stays shared across
 * `vi.resetModules()` cycles — the vi.mock factory runs only once and keeps
 * closure over the first module instance, while tests re-import helpers for
 * fresh module registries. Call `resetElectronMock()` in beforeEach to get
 * a fresh tmp userData dir, handler map and webContents registry.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'

export interface FakeWebContents {
  id: number
  destroyed: boolean
  send: ReturnType<typeof vi.fn>
  isDestroyed(): boolean
}

export interface FakeIpcEvent {
  sender: FakeWebContents
  returnValue?: unknown
}

interface MockState {
  handlers: Map<string, (event: FakeIpcEvent, ...args: unknown[]) => unknown>
  webContents: Map<number, FakeWebContents>
  userDataPath: string
}

const globalKey = '__cwsElectronMockState__'
const state: MockState =
  ((globalThis as Record<string, unknown>)[globalKey] as MockState | undefined) ??
  (((globalThis as Record<string, unknown>)[globalKey] = {
    handlers: new Map(),
    webContents: new Map(),
    userDataPath: '',
  }) as MockState)

export const electronMock = {
  app: {
    getPath: vi.fn((name: string): string => {
      if (name === 'userData') {
        if (!state.userDataPath) state.userDataPath = mkdtempSync(join(tmpdir(), 'cws-test-'))
        return state.userDataPath
      }
      throw new Error(`electron-mock: unexpected getPath(${name})`)
    }),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
  },
  ipcMain: {
    on: vi.fn((ch: string, handler: (event: FakeIpcEvent, ...args: unknown[]) => unknown) => {
      state.handlers.set(ch, handler)
    }),
    handle: vi.fn(),
  },
  webContents: {
    fromId: vi.fn((id: number): FakeWebContents | undefined => state.webContents.get(id)),
  },
}

/** Fresh state: new tmp userData dir, empty handlers and webContents. */
export function resetElectronMock(): string {
  if (state.userDataPath) {
    rmSync(state.userDataPath, { recursive: true, force: true })
  }
  state.userDataPath = mkdtempSync(join(tmpdir(), 'cws-test-'))
  state.handlers.clear()
  state.webContents.clear()
  return state.userDataPath
}

export function currentUserDataPath(): string {
  return state.userDataPath
}

/** Create a fake webContents that `webContents.fromId` will resolve. */
export function makeFakeWebContents(id: number): FakeWebContents {
  const existing = state.webContents.get(id)
  if (existing) return existing
  const wc: FakeWebContents = {
    id,
    destroyed: false,
    send: vi.fn(),
    isDestroyed() {
      return this.destroyed
    },
  }
  state.webContents.set(id, wc)
  return wc
}

/** Build the ipcMain event object a renderer message would carry. */
export function makeIpcEvent(senderId: number): FakeIpcEvent {
  return { sender: makeFakeWebContents(senderId) }
}

/** Invoke a registered ipcMain.on handler as the renderer message would. */
export function invokeHandler(ch: string, event: FakeIpcEvent, ...args: unknown[]): unknown {
  const handler = state.handlers.get(ch)
  if (!handler) throw new Error(`electron-mock: no handler registered for ${ch}`)
  return handler(event, ...args)
}

/** Let `app.whenReady().then(...)` chains flush so IPC handlers register. */
export async function flushIpcSetup(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
