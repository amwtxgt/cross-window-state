# Web mode

The renderer entry works **unchanged** in plain browser tabs. When `window.__crossWindowState__` is absent, every state switches to a local bus:

| Concern | Electron mode | Web mode |
|---|---|---|
| Runtime state store | main process memory | per-tab memory |
| Runtime cross-context sync | IPC broadcast | `BroadcastChannel('cws:bus')` |
| Storage persistence | JSON file in `userData` | `localStorage['cws:{name}']` |
| Storage cross-tab sync | IPC broadcast | BroadcastChannel patches |
| Version migration | yes (main process runs it) | version mismatch → defaults |

```ts
// The same file runs in Electron windows AND plain web pages.
import { createStorageState } from 'cross-window-state/renderer'

const settings = createStorageState('settings', { locale: 'en' }, 1)
settings.set('locale', 'zh') // other tabs update live
```

## Semantics you can rely on

- `set()` notifies the local page **synchronously** in both modes (the Electron main process broadcasts to every window including the writer).
- A tab that only *subscribes* still receives everything: the BroadcastChannel is created at module load, before any state — no missed early broadcasts.
- `localStorage` failures (quota, private mode) never throw: memory state remains the source of truth for the session.
- `destroy()` of a runtime state is **local-only** on web — closing/clearing in one tab never wipes the value for its siblings (mirrors the Electron reference-count semantics).

## Known differences (by design)

- **No replay for late tabs**: a tab opened later cannot read runtime values set before it existed (there is no shared memory). Storage values are fine — they come from `localStorage`.
- **No migration chain**: with no main process to run one, a version mismatch resets to defaults and persists the new version.
