# API: Runtime state

```ts
import { createRuntimeState } from 'cross-window-state/main'     // main process
import { createRuntimeState } from 'cross-window-state/renderer' // renderer / web
```

Identical signature and semantics on both ends — enforced by the contract suite.

## createRuntimeState

```ts
function createRuntimeState<T>(
  name: string,
  defaultValue?: T,
  options?: RuntimeStateOptions,
): RuntimeState<T>
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Global state name. Same name = same state, everywhere. |
| `defaultValue` | `T` | Initial value when the state does not exist yet. |
| `options.readonly` | `boolean` | Reject `.set()` with a console error (shared read-only view). |

## RuntimeState

```ts
interface RuntimeState<T> {
  readonly state: T
  set(value: T): void
  watch(cb: (newVal: T, oldVal: T | undefined) => void): () => void
  destroy(): void
}
```

### `.state`

Current value. On the renderer, reads never block after creation (the initial value is fetched synchronously once).

### `.set(value)`

Write a new value. Propagates to the main process and every window immediately (renderer updates local state optimistically; the arriving broadcast is de-duplicated, so watchers fire exactly once per change on the writing page too).

`set(undefined)` on the main process clears the state entry; on web it notifies listeners with `undefined`.

### `.watch(cb)`

Subscribe to changes from **any** end (local, other windows, main process). Returns an unsubscribe function.

### `.destroy()`

Release this handle and unsubscribe. When the last holder (main + windows) is destroyed the state is garbage-collected. After destroy, `set`/`watch` are rejected with a console error; double destroy warns.

::: tip Renderer caching
Same-name `createRuntimeState` calls on one page return the **same instance** (one bus subscription). `destroy()` clears the cache entry, so a subsequent create builds a fresh state.
:::

## Example

```ts
const panels = createRuntimeState('open-panels', ['outline'])
const off = panels.watch((next) => saveLayoutLocally(next))
panels.set(['outline', 'terminal'])
off()
panels.destroy()
```
