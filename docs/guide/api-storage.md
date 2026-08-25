# API: Storage state

```ts
import { createStorageState } from "cross-window-state/main"; // also exports StorageStore
import { createStorageState } from "cross-window-state/renderer";
```

## createStorageState

```ts
function createStorageState<T extends Record<string, unknown>>(
  name: string,
  defaults: T,
  version: number,
  options?: StorageStateOptions,
): StorageState<T>;
```

| Parameter                   | Type      | Description                                                  |
| --------------------------- | --------- | ------------------------------------------------------------ |
| `name`                      | `string`  | Store name (`[a-zA-Z0-9_-]+`); also the file name.           |
| `defaults`                  | `T`       | Default values; defines the observable key set.              |
| `version`                   | `number`  | Schema version — bump to trigger migration.                  |
| `options.skipDefaultsCheck` | `boolean` | Reuse an existing store even with different defaults.        |
| `options.maxRetries`        | `number`  | Write attempts after failure. Default `3`.                   |
| `options.retryDelay`        | `number`  | Delay between retries (ms). Default `1000`.                  |
| `options.dir`               | `string`  | Subdirectory under `userData`. Default `cross-window-state`. |

## StorageState

```ts
interface StorageState<T> {
  readonly state: T; // writable proxy
  set<K extends keyof T & string>(key: K, value: T[K]): void;
  set(patch: Partial<T>): void;
  watch<K extends keyof T & string>(
    key: K,
    cb: (newValue: T[K], oldValue: T[K] | undefined) => void,
  ): () => void;
  destroy(): void;
}
```

### `.state` — the writable proxy

Reads return the merged current data. **Writes go through the sync pipeline automatically**:

```ts
settings.state.locale = "zh"; // sync + persist, everywhere
delete settings.state.locale; // key reads undefined afterwards
```

This is first-class usage, not a compromise — the same `createProxyState` core powers both the main-process store and the renderer state.

### `.set(key, value)` / `.set(patch)`

Single key or partial patch. Patches merge — they never delete keys.

### `.watch(key, cb)`

Per-key subscription covering changes from any end. Keys outside `defaults` can be watched too (subscribes lazily).

### `.destroy()`

Unsubscribe from the bus. On the main process, also flushes pending debounced writes synchronously and removes the instance from the registry.

## Versioned migration

When the persisted `version` differs from the constructor's, stored data migrates against the **current** defaults:

- key in defaults but not stored → **added**, gets the default
- key stored but not in defaults → **removed**
- key type changed (`typeof`) → **reset** to the default

Works for both upgrades and downgrades; the migrated data and new version are written to disk immediately.

## Persistence guarantees

- Debounced 300 ms trailing writes; a burst of sets writes once with the final value.
- Atomic write (`tmp` + `rename`), with a direct-write fallback when rename fails.
- Serialized through a drain loop that always persists the **latest** snapshot — a queued write can never clobber newer state.
- Corrupted JSON file → falls back to defaults **and repairs the file** immediately.
- App quit (`will-quit`) flushes everything synchronously — the last 300 ms of changes are not lost.

## Main-process extras

`StorageStore` (re-exported from `cross-window-state/main`) additionally exposes `subscribe(cb)` (full-state snapshot on any change) and static `instances` — the live store registry.
