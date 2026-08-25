# Vue bridge

`cross-window-state/vue` provides composables for Vue 3 apps. `vue >= 3.3` is an optional peer dependency — only install it if you use this entry.

```bash
pnpm add cross-window-state vue
```

## useRuntimeState

```ts
import { useRuntimeState } from "cross-window-state/vue";

const { state, set, watch } = useRuntimeState("theme", "light");
// state: ShallowRef<'light'> — use directly in templates
set("dark");
```

## useStorageState

```ts
import { useStorageState } from "cross-window-state/vue";

const { state, proxy, set } = useStorageState("settings", { locale: "en" }, 1);
// state: ShallowRef snapshot, refreshed on any watched key change
// proxy: the writable state — proxy.locale = 'zh' syncs + persists + refreshes state
```

## Lifecycle

Disposal (component unmount, `effectScope.stop()`) only unsubscribes **this** composable's watcher. It never destroys the underlying state, which is shared by name across every consumer on the page:

```ts
const scopeA = effectScope();
const a = scopeA.run(() => useRuntimeState("shared", "one"));
scopeA.stop(); // a stops updating; the state itself lives on

const b = useRuntimeState("shared", "one");
b.set("two"); // still works
```

## SSR

The web-mode bus degrades safely during SSR (no `window`): states work in memory and persistence is skipped until hydration. No special setup is required.
