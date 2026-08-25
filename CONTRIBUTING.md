# Contributing to cross-window-state

Thanks for helping! This repo is a pnpm workspace: the library at the root, a runnable example under `examples/basic`.

## Setup

```bash
pnpm install
pnpm test   # unit + contract suites
pnpm e2e    # real Electron windows + browser tabs (needs `pnpm exec playwright install chromium`)
```

## Before opening a PR

1. `pnpm lint` (oxlint + oxfmt) and `pnpm typecheck` must pass.
2. `pnpm test` must pass — in particular the **contract suite** runs the same behavioral matrix against the main and renderer factories; if your change breaks one end, it will fail there.
3. Behavior changes need tests. Bug fixes need a regression test that fails without the fix (see `test/unit/preload/index.test.ts` for a good example — it locks an unsubscribe bug from the predecessor implementation).
4. Add a changeset: `pnpm changeset` → pick minor/patch → describe the change for the changelog.

## Design invariants

- **Zero-difference DX**: main and renderer factories keep identical names, signatures and semantics. New behavior lands on both ends or neither.
- **Core stays dependency-free**: `src/core` must not import electron, vue, or anything else.
- **Web mode stays semantics-aligned** with Electron mode; deliberate differences (documented in `docs/guide/web-mode.md`) are the only exceptions.
- English code comments and docs; commit messages in English, conventional-commit style.

## Release flow (maintainers)

Changesets + GitHub Action: merge PRs with changesets to `main`, the Version Packages PR applies them, and the Release workflow publishes to npm. Requires the `NPM_TOKEN` secret (see `.github/workflows/release.yml`).
