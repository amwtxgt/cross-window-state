# API: SyncArray

Array ergonomics on top of a runtime state — every mutation commits through `state.set()`, so all windows stay in sync without you remembering to re-send.

```ts
import { SyncArray } from "cross-window-state"; // also from /main and /renderer
```

## Constructor

```ts
new SyncArray<T>(state: RuntimeStateLike<T[]>, initial: T[] = [])
```

Adopts a non-empty remote value when one exists (a late joiner keeps the live data); otherwise seeds the state with `initial`.

## Mutating methods (each = exactly one `state.set`)

| Method    | Signature                                                                  |
| --------- | -------------------------------------------------------------------------- |
| `push`    | `(...items: T[]) => number`                                                |
| `splice`  | `(start: number, deleteCount?: number, ...items: T[]) => T[]`              |
| `replace` | `(newData: T[]) => void` — replace the whole dataset                       |
| `remove`  | `(predicate: (item: T, index: number) => boolean) => void`                 |
| `batch`   | `(mutator: (draft: T[]) => void) => void` — many mutations, **one commit** |

## Read methods (never touch the wire)

`all` (defensive copy), `length`, `at` (negative index supported), `find`, `findIndex`, `filter`, `some`, `includes`, `forEach`, `map`.

## Example

```ts
const tasks = new SyncArray(createRuntimeState<Task[]>("tasks", []), []);

tasks.push({ id: 1, title: "ship" });
tasks.batch((draft) => {
  draft.push({ id: 2, title: "test" });
  draft.splice(0, 1);
});
tasks.remove((t) => t.id === 2);
tasks.all; // fresh copy, safe to iterate
```

::: tip Why batch exists
Each `set` is one IPC broadcast. `batch` collapses a burst of mutations into a single commit — intermediate shapes never hit the wire.
:::
