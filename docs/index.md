---
hero:
  name: cross-window-state
  tagline: One state, many windows, always in sync.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/YOUR_USER/cross-window-state
---

# One state, many windows, always in sync

Shared reactive state for **Electron multi-window apps** and **cross-tab web apps**, with built-in persistence and versioned migration.

- **One source of truth** — main process and every window share the same state.
- **Zero-difference DX** — identical factories on main and renderer, locked by contract tests.
- **Dual host** — the same renderer code runs in Electron and plain browser tabs.
- **Persistent & atomic** — JSON storage with migrations, tmp+rename writes and app-quit flush.

Head to the [getting started](./guide/getting-started) guide.
