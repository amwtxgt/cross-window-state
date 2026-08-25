# Migrating from raw IPC

The library is the extracted, hardened version of the hand-rolled `ipcMain.handle` / `ipcRenderer.send` pattern. Mapping table:

| Raw IPC | cross-window-state |
|---|---|
| `ipcMain.handle('get-theme', () => theme)` | `createRuntimeState('theme', 'light')` in main |
| `ipcRenderer.invoke('get-theme')` + local cache | `createRuntimeState('theme', 'light')` in renderer |
| `ipcRenderer.send('set-theme', v)` + `webContents.send('theme-changed', v)` loop | `theme.set(v)` — propagation is automatic |
| `window.addEventListener('storage')` cross-tab hacks | nothing — web mode handles it |
| JSON settings file + `Object.keys` diffing on startup | `createStorageState(name, defaults, version)` |

## Migration steps

1. **Pick state names and defaults.** One runtime or storage state per logical unit (`theme`, `settings`, `openPanels`…). Names are global across the app.
2. **Wire the three ends** ([Electron setup](./electron-setup)): one import in main, one in preload, one in renderer.
3. **Replace IPC calls with state operations.** Anywhere you used to `send` and re-broadcast, now `.set()`; anywhere you cached and listened, now `.watch()`.
4. **Version your persisted shapes.** Start storage states at `version: 1`; when `defaults` change shape, bump the version — migration runs automatically.
5. **Delete your IPC channel code.** The `cws:` namespaced protocol replaces it without collisions.

## Gotchas

- **Shallow reactivity**: mutating a nested object in place does not notify — assign a fresh reference or call `.set()` again.
- **Keys must be declared**: cross-window storage updates only arrive for keys present in that page's `defaults` (or explicitly `.watch()`-ed).
- **The first read is synchronous** (`sendSync`, once per state creation) so states are usable at module scope. See the [FAQ](https://github.com/YOUR_USER/cross-window-state#faq) for the trade-off discussion.
