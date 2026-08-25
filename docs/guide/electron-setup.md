# Electron setup

Three files, one import each.

## 1. Main process

```ts
// src/main/index.ts
import "cross-window-state/main"; // registers IPC handlers once app is ready
import { createRuntimeState, createStorageState } from "cross-window-state/main";

const layout = createRuntimeState("layout", { sidebar: true });
const settings = createStorageState("settings", { locale: "en" }, 1);
```

Importing the entry is all the setup needed — runtime IPC handlers register in the manager constructor and storage handlers on `app.whenReady()`.

## 2. Preload (must be CJS)

Sandboxed preloads do not support ESM, so this entry ships as a single `.cjs` file. With a bundler (electron-vite, electron-forge) just import it:

```ts
// src/preload/index.ts — bundled to CJS
import "cross-window-state/preload";
```

Or reference the built file directly without a bundler:

```js
// preload.js (plain CJS, no bundler)
require("cross-window-state/preload");
```

::: warning Bundler pitfall
If your bundler **externalizes** the library (e.g. it lists the package under `dependencies` with electron-vite's defaults), the sandbox will fail to resolve it at runtime. Keep the library in `devDependencies` of the host app (or otherwise inline it) so the preload bundle contains the bridge code. `sideEffects` is `true` in our package — pure side-effect imports are never shaken.
:::

Recommended `webPreferences`:

```ts
new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, "../preload/index.js"),
    contextIsolation: true, // required
    nodeIntegration: false,
    sandbox: true, // supported
  },
});
```

## 3. Renderer

```ts
import { createRuntimeState } from "cross-window-state/renderer";

const layout = createRuntimeState("layout", { sidebar: true });
layout.watch((v) => render(v));
```

The renderer detects `window.__crossWindowState__` at module load — injected by the preload before any page script runs, so the detection is stable for the page lifetime.

## Persistence details

- Storage files live under `<userData>/cross-window-state/<name>.json` (override the subdirectory with the `dir` option).
- Writes are debounced 300 ms, atomic (`file.json.tmp` + rename, with a direct-write fallback), retried up to `maxRetries` (default 3, `retryDelay` 1000 ms).
- All pending writes are flushed synchronously on `destroy()` and on `will-quit` — nothing is lost in the last debounce window before app exit.

## IPC channel names

Every channel is namespaced with `cws:` (e.g. `cws:runtime:update:theme`, `cws:storage:update:settings:locale`) so the library can never collide with your own channels. See the root entry exports (`channel`, `runtimeUpdateChannel`, `storageUpdateChannel`) if you need to observe them in devtools.
