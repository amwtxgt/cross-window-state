# API: Vue bridge

```ts
import { useRuntimeState, useStorageState } from "cross-window-state/vue";
```

Requires `vue >= 3.3` (optional peer).

## useRuntimeState

```ts
function useRuntimeState<T>(
  name: string,
  defaultValue?: T,
  options?: { readonly?: boolean },
): {
  state: ShallowRef<T>;
  set(value: T): void;
  watch(cb: (newVal: T, oldVal: T | undefined) => void): () => void;
};
```

`state` is a `ShallowRef` initialized from the current value and updated by every change, from any window. Use it directly in templates.

## useStorageState

```ts
function useStorageState<T extends Record<string, unknown>>(
  name: string,
  defaults: T,
  version: number,
  options?: StorageStateOptions,
): {
  state: ShallowRef<Record<string, unknown>>; // snapshot, auto-refreshed
  proxy: T; // writable: proxy.k = v
  set(keyOrPatch, value?): void;
  watch(key, cb): () => void;
};
```

- `state` is a **snapshot** shallowRef refreshed whenever any defaults key changes (including your own proxy writes and cross-window updates).
- `proxy` is the underlying writable proxy from [`createStorageState`](./api-storage) — writes sync + persist and refresh `state`.

```ts
const { state, proxy } = useStorageState("settings", { locale: "en" }, 1);
proxy.locale = "zh";
// state.value now equals { locale: 'zh' } — templates update
```

## Scope lifecycle

`onScopeDispose` only unsubscribes this composable's watchers. The underlying state is shared by name and never destroyed by a scope going away — a second consumer in another component keeps working.

```ts
const scope = effectScope();
const a = scope.run(() => useRuntimeState("theme", "light"));
scope.stop(); // 'theme' state survives; other consumers unaffected
```

## Composition example

```vue
<script setup>
import { useRuntimeState, useStorageState } from "cross-window-state/vue";

const { state: theme, set: setTheme } = useRuntimeState("theme", "light");
const { state: settings, proxy: settingsProxy } = useStorageState(
  "settings",
  { locale: "en", notifications: true },
  1,
);
</script>

<template>
  <p>theme: {{ theme }}</p>
  <button @click="setTheme('dark')">dark</button>
  <select v-model="settingsProxy.locale">
    <option value="en">en</option>
    <option value="zh">zh</option>
  </select>
  <pre>{{ settings }}</pre>
</template>
```
