/**
 * Shared electron mock for main-process unit tests.
 *
 * Usage in a test file:
 *   vi.mock('electron', async () => {
 *     const m = await import('./helpers/electron-impl')
 *     return { ...m.electronMock }
 *   })
 *
 * The mock is a per-test-file singleton; call `resetElectronMock()` in
 * beforeEach to get a fresh tmp userData dir, handler map and webContents
 * registry.
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

const handlers = new Map<string, (event: FakeIpcEvent, ...args: unknown[]) => unknown>()
const webContentsRegistry = new Map<number, FakeWebContents>()
let userDataPath = ''

export const electronMock = {
  app: {
    getPath: vi.fn((name: string): string => {
      if (name === 'userData') {
        if (!userDataPath) userDataPath = mkdtempSync(join(tmpdir(), 'cws-test-'))
        return userDataPath
      }
      throw new Error(`electron-mock: unexpected getPath(${name})`)
    }),
    whenReady: vi.fn(() => Promise.resolve()),
  },
  ipcMain: {
    on: vi.fn((ch: string, handler: (event: FakeIpcEvent, ...args: unknown[]) => unknown) => {
      handlers.set(ch, handler)
    }),
    handle: vi.fn(),
  },
  webContents: {
    fromId: vi.fn((id: number): FakeWebContents | undefined => webContentsRegistry.get(id)),
  },
}

/** Fresh state: new tmp userData dir, empty handlers and webContents. */
export function resetElectronMock(): string {
  if (userDataPath) {
    rmSync(userDataPath, { recursive: true, force: true })
  }
  userDataPath = mkdtempSync(join(tmpdir(), 'cws-test-'))
  handlers.clear()
  webContentsRegistry.clear()
  return userDataPath
}

export function currentUserDataPath(): string {
  return userDataPath
}

/** Create a fake webContents that `webContents.fromId` will resolve. */
export function makeFakeWebContents(id: number): FakeWebContents {
  const wc: FakeWebContents = {
    id,
    destroyed: false,
    send: vi.fn(),
    isDestroyed() {
      return this.destroyed
    },
  }
  webContentsRegistry.set(id, wc)
  return wc
}

/** Build the ipcMain event object a renderer message would carry. */
export function makeIpcEvent(senderId: number): FakeIpcEvent {
  // Reuse an existing fake so the event's sender is the same object the
  // test holds a reference to (registry keeps one entry per id).
  const existing = webContentsRegistry.get(senderId)
  return { sender: existing ?? makeFakeWebContents(senderId) }
}

/** Invoke a registered ipcMain.on handler as the renderer message would. */
export function invokeHandler(ch: string, event: FakeIpcEvent, ...args: unknown[]): unknown {
  const handler = handlers.get(ch)
  if (!handler) throw new Error(`electron-mock: no handler registered for ${ch}`)
  return handler(event, ...args)
}

/** Let `app.whenReady().then(...)` chains flush so IPC handlers register. */
export async function flushIpcSetup(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
