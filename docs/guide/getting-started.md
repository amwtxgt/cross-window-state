# Getting started

Install:

```bash
pnpm add cross-window-state
# Electron only: peer is electron >= 28 (optional for web-only usage)
```

`cross-window-state` ships five entries:

| Entry | Environment | Purpose |
|---|---|---|
| `cross-window-state` | any | IPC protocol constants, shared types, `SyncArray` |
| `cross-window-state/main` | Electron main | `createRuntimeState`, `createStorageState` |
| `cross-window-state/preload` | preload (CJS) | exposes `window.__crossWindowState__` |
| `cross-window-state/renderer` | renderer / browser | same factories as main; auto-detects host |
| `cross-window-state/vue` | renderer (Vue 3) | `useRuntimeState` / `useStorageState` |

## The 30-second tour

```ts
// main process
import { createRuntimeState, createStorageState } from 'cross-window-state/main'

const theme = createRuntimeState('theme', 'light')
const settings = createStorageState('settings', { locale: 'en' }, 1)
```

```ts
// any renderer — identical signatures
import { createRuntimeState, createStorageState } from 'cross-window-state/renderer'

const theme = createRuntimeState('theme', 'light')
theme.watch((v) => console.log(v)) // fires in every window
theme.set('dark')
```

Next: [Electron setup](./electron-setup) for the preload wiring, or [Web mode](./web-mode) if you don't use Electron at all.

## Two kinds of state

- **Runtime state** — memory-only, shared live across windows and the main process, garbage-collected when the last holder goes away. Perfect for UI-ish, session-scoped data.
- **Storage state** — persisted as JSON (`<userData>/cross-window-state/<name>.json` on Electron, `localStorage` on web), with versioned migration. Perfect for settings.
