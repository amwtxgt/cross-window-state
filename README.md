# cross-window-state

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088ff?logo=githubactions&logoColor=white)](https://github.com/amwtxgt/cross-window-state/actions)
[![npm](https://img.shields.io/badge/npm-cross--window--state-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/cross-window-state)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](./tsconfig.json)

**One state, many windows, always in sync.**

Shared reactive state for Electron multi-window apps and cross-tab web apps — with built-in persistence, versioned migration, and the exact same API on the main process and every renderer.

- **One source of truth** — every window and the main process share the same state; a write anywhere is visible everywhere immediately.
- **Reactive by default** — subscribe with `.watch()`, or use the optional Vue bridge; no polling, no manual refresh.
- **Zero-difference DX** — `createRuntimeState` / `createStorageState` have identical names, signatures and semantics on main and renderer. The transport (IPC vs. BroadcastChannel) is an implementation detail.
- **Dual host** — the same renderer code runs in Electron windows _and_ plain browser tabs (localStorage + BroadcastChannel fallback).
- **Persistent, migrated, atomic** — storage states survive restarts, migrate on version bumps (added / removed / type-changed keys), and write atomically (tmp + rename) with retries.
- **Dependency-free core** — a ~50-line signal primitive replaces framework reactivity; works with any UI stack. Vue users get a first-class bridge.

[Quick start](#quick-start) · [Documentation](https://amwtxgt.github.io/cross-window-state/) · [中文文档](./README.zh-CN.md)

## Why

|                                               | electron-store      | zustand cross-tab | cross-window-state          |
| --------------------------------------------- | ------------------- | ----------------- | --------------------------- |
| Main process + all windows, one state         | ❌ (main-only JSON) | ❌                | ✅                          |
| Runtime (memory) + storage (persisted) states | ❌ persist-only     | partial           | ✅ both                     |
| Same API on main and renderer                 | —                   | —                 | ✅ locked by contract tests |
| Versioned migration                           | ✅                  | ❌                | ✅                          |
| Web fallback (no Electron)                    | ❌                  | ✅                | ✅                          |
| Framework-free core                           | n/a                 | React-first       | ✅ (Vue bridge optional)    |

If you have ever copy-pasted `ipcMain.handle` / `ipcRenderer.send` pairs just to keep two windows in sync, this library is that code — extracted, hardened, and tested.

## Installation

```bash
pnpm add cross-window-state
# Electron apps also want the dev dependency for examples/tooling:
pnpm add -D electron   # >= 28
```

Vue support is an optional peer: install `vue >= 3.3` only if you use `/vue`.

## Quick start (30 seconds, all three ends)

**1. Main process** — import once; states are created exactly like on the renderer:

```ts
// src/main/index.ts
import { createRuntimeState, createStorageState } from "cross-window-state/main";

const theme = createRuntimeState("theme", "light");
theme.set("dark"); // every window updates immediately

const settings = createStorageState("settings", { locale: "en", notifications: true }, 1);
settings.state.locale = "zh"; // direct proxy write: syncs + persists
```

**2. Preload** — one line; it must be CJS (sandboxed preloads don't support ESM):

```ts
// src/preload/index.ts (bundled by electron-vite / electron-builder as CJS)
import "cross-window-state/preload";
```

**3. Renderer** — same factories, same signatures. In a browser tab (no preload), the exact same code transparently switches to localStorage + BroadcastChannel:

```ts
// src/renderer anywhere
import { createRuntimeState, createStorageState } from "cross-window-state/renderer";

const theme = createRuntimeState("theme", "light");
theme.watch((v) => console.log("theme is now", v));
theme.set("dark"); // propagates to the main process and all windows

const settings = createStorageState("settings", { locale: "en", notifications: true }, 1);
settings.set("locale", "zh"); // single key
settings.set({ notifications: false }); // partial patch
settings.state.locale = "en"; // or just write the proxy
```

**Vue bridge** (optional):

```ts
import { useRuntimeState } from "cross-window-state/vue";

const { state, set } = useRuntimeState("theme", "light");
// state is a ShallowRef — templates update automatically
```

Runnable apps live in [`examples/`](./examples):

- [`examples/basic`](./examples/basic) — minimal counter/settings demo (also the e2e harness)
- [`examples/notes`](./examples/notes) — realistic Vue 3 multi-window app: sticky-notes board + read-only preview window, persistence with versioned migration, main-process feeds, presence, and web (multi-tab) mode

One-liners from the repository root (the library builds itself first):

```bash
pnpm example:notes      # Electron: board + preview windows
pnpm example:notes:web  # browser tabs → http://localhost:4173
pnpm example:basic      # minimal Electron demo
pnpm example:basic:web  # browser tabs
```

## API summary

| API                                                        | Where           | Purpose                                                                           |
| ---------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `createRuntimeState<T>(name, defaultValue?, options?)`     | main + renderer | In-memory shared state: `.state`, `.set(v)`, `.watch(cb)`, `.destroy()`           |
| `createStorageState<T>(name, defaults, version, options?)` | main + renderer | Persistent JSON state (same shape, plus writable `.state` proxy)                  |
| `new SyncArray<T>(runtimeState, initial)`                  | main + renderer | Array API that commits through a runtime state (`push/splice/batch/…`)            |
| `useRuntimeState / useStorageState`                        | renderer (Vue)  | `ShallowRef` views; scope disposal only unsubscribes, never destroys shared state |
| `channel`, `runtimeUpdateChannel(key)`, …                  | root            | IPC wire protocol constants (namespaced `cws:`), for interop/debugging            |

Runtime states are garbage-collected when neither the main process nor any window holds a reference. Storage states write to `<userData>/cross-window-state/<name>.json`, debounced 300 ms, flushed on destroy and on app quit.

### Migration on version bump

Bump `version` and change `defaults` — stored data migrates automatically: keys missing from defaults are removed, new keys get their defaults, type-changed keys reset to defaults.

## FAQ

**Why is the first read synchronous (`sendSync`)?**
State must be usable immediately at module scope — async init would make every consumer `await` before reading. `sendSync` runs once per state creation, not per read. Trading a one-time sync IPC for a fundamentally simpler API is deliberate; if it ever becomes a startup bottleneck, an async init mode can be added without changing call sites' logic.

**I mutated a nested object — why did nothing sync?**
States are shallow-reactive by design. After mutating, assign a fresh reference (`state.items = [...state.items]`) or call `.set()` again. This keeps change detection O(1) and serialization predictable.

**A key added by another window doesn't appear here.**
Storage key subscriptions cover the keys your `defaults` declare (plus anything you `.watch()`). Declare a key in defaults to make it visible everywhere — undeclared keys are intentionally invisible (they cannot be typed or validated anyway).

**Does web mode persist like Electron mode?**
Yes — localStorage replaces the JSON file. Version mismatch falls back to defaults (the web has no main process to run a migration chain).

**Can untrusted renderer code write state?**
All renderers are equally trusted, like the rest of Electron's IPC surface. Do not load untrusted remote pages in windows that share state.

## Documentation

The [VitePress site](https://amwtxgt.github.io/cross-window-state/) has the full guides: [Getting started](https://amwtxgt.github.io/cross-window-state/guide/getting-started), [Electron setup](https://amwtxgt.github.io/cross-window-state/guide/electron-setup), [Web mode](https://amwtxgt.github.io/cross-window-state/guide/web-mode), [Vue bridge](https://amwtxgt.github.io/cross-window-state/guide/vue-bridge), [Migrating from raw IPC](https://amwtxgt.github.io/cross-window-state/guide/migration-from-raw-ipc), and the API references for [runtime](https://amwtxgt.github.io/cross-window-state/guide/api-runtime), [storage](https://amwtxgt.github.io/cross-window-state/guide/api-storage), [SyncArray](https://amwtxgt.github.io/cross-window-state/guide/api-sync-array) and [Vue](https://amwtxgt.github.io/cross-window-state/guide/api-vue).

## Development

```bash
pnpm install
pnpm test       # unit + contract suites
pnpm e2e        # real Electron windows + real browser tabs
pnpm build      # dist (dual format + preload cjs)
pnpm lint       # oxlint + oxfmt
```

The main/renderer parity is enforced by running the _same_ behavioral contract suite against both factories — any drift fails CI.

## License

[MIT](./LICENSE)
