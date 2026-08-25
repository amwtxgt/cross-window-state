# cross-window-state — basic example

A minimal Electron app demonstrating the library, and the e2e harness for the repository.

- **runtime counter** — click `+1` in one window, watch both windows update
- **storage settings** — change theme/notifications, restart the app, values are restored
- **open new window** — a third window joins already in sync
- **web mode** — `examples/basic/web/index.html` runs the *same renderer code* in a plain browser (localStorage + BroadcastChannel)

## Run

```bash
# from the repository root
pnpm install
pnpm build                                        # build the library (dist/)
pnpm --filter cross-window-state-example-basic dev  # Electron dev mode

# web mode
pnpm --filter cross-window-state-example-basic build:web
pnpm --filter cross-window-state-example-basic preview
```

::: note
The example keeps `cross-window-state` in **devDependencies** on purpose: electron-vite externalizes `dependencies`, and a sandboxed preload cannot resolve bare node_modules specifiers at runtime. devDependencies get inlined into the preload bundle.
:::

## Layout

```
examples/basic/
├── src/main/index.ts        # main process: two windows + both state kinds
├── src/preload/index.ts     # one library import + a demo-only window opener
├── src/renderer/            # shared renderer logic (vanilla TS)
├── web/index.html           # same logic, browser tab
└── electron.vite.config.ts
```
