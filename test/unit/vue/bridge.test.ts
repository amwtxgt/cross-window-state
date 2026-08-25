import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

vi.stubGlobal(
  "BroadcastChannel",
  class {
    onmessage: unknown = null;
    close(): void {}
    postMessage(): void {}
  },
);

const memoryStorage = {
  store: new Map<string, string>(),
  getItem(key: string): string | null {
    return memoryStorage.store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memoryStorage.store.set(key, value);
  },
  removeItem(key: string): void {
    memoryStorage.store.delete(key);
  },
  clear(): void {
    memoryStorage.store.clear();
  },
};
vi.stubGlobal("localStorage", memoryStorage);

let mod: typeof import("../../../src/vue/index");
let rendererMod: typeof import("../../../src/renderer/index");

beforeEach(async () => {
  vi.resetModules();
  memoryStorage.clear();
  mod = await import("../../../src/vue/index");
  rendererMod = await import("../../../src/renderer/index");
});

describe("useRuntimeState", () => {
  it("returns a shallowRef initialized to the current value", () => {
    const scope = effectScope();
    const result = scope.run(() => mod.useRuntimeState("theme", "light"));
    expect(result).toBeTruthy();
    expect(result?.state.value).toBe("light");
    scope.stop();
  });

  it("set updates the ref immediately", () => {
    const scope = effectScope();
    const theme = scope.run(() => mod.useRuntimeState("theme", "light"));
    theme?.set("dark");
    expect(theme?.state.value).toBe("dark");
    scope.stop();
  });

  it("a bridge update (another same-name consumer setting) moves the ref", () => {
    const scopeA = effectScope();
    const a = scopeA.run(() => mod.useRuntimeState("counter", 0));
    const other = rendererMod.createRuntimeState("counter", 0);
    other.set(7);
    expect(a?.state.value).toBe(7);
    scopeA.stop();
  });

  it("scope disposal stops this subscription but does NOT destroy the shared state", () => {
    const scopeA = effectScope();
    const a = scopeA.run(() => mod.useRuntimeState("shared", "one"));

    const scopeB = effectScope();
    const b = scopeB.run(() => mod.useRuntimeState("shared", "one"));

    scopeA.stop(); // a's watcher unsubscribed; the underlying state survives

    b?.set("two");
    expect(b?.state.value).toBe("two");

    // a's ref no longer updates (subscription gone) — but reading it still
    // returns its last value without throwing
    expect(a?.state.value).toBe("one");
    scopeB.stop();
  });

  it("watch passes through to the runtime state", () => {
    const scope = effectScope();
    const theme = scope.run(() => mod.useRuntimeState("theme2", "light"));
    const seen: string[] = [];
    theme?.watch((v) => seen.push(v));
    theme?.set("dark");
    expect(seen).toEqual(["dark"]);
    scope.stop();
  });
});

describe("useStorageState", () => {
  it("initializes the snapshot from defaults merged with persisted state", () => {
    const scope = effectScope();
    const s = scope.run(() => mod.useStorageState("settings", { theme: "light", lang: "en" }, 1));
    expect(s?.state.value).toEqual({ theme: "light", lang: "en" });
    scope.stop();
  });

  it("set(key, value) refreshes the snapshot", () => {
    const scope = effectScope();
    const s = scope.run(() => mod.useStorageState("settings", { theme: "light" }, 1));
    s?.set("theme", "dark");
    expect(s?.state.value).toEqual({ theme: "dark" });
    scope.stop();
  });

  it("proxy writes reflect into the ref", () => {
    const scope = effectScope();
    const s = scope.run(() => mod.useStorageState("settings", { theme: "light" }, 1));
    expect(s).toBeTruthy();
    if (!s) return;
    s.proxy.theme = "dark";
    expect(s.state.value).toEqual({ theme: "dark" });
    scope.stop();
  });

  it("a cross-window update moves the ref", async () => {
    const scopeA = effectScope();
    const a = scopeA.run(() => mod.useStorageState("cfg", { count: 0 }, 1));

    // simulate another window: fresh module registry is not needed on the
    // same page — a second state instance shares the bus
    const other = rendererMod.createStorageState("cfg", { count: 0 }, 1);
    other.set("count", 5);
    expect(a?.state.value).toEqual({ count: 5 });
    scopeA.stop();
  });

  it("scope disposal keeps the shared storage state alive for others", () => {
    const scopeA = effectScope();
    scopeA.run(() => mod.useStorageState("cfg2", { x: 1 }, 1));
    const scopeB = effectScope();
    const b = scopeB.run(() => mod.useStorageState("cfg2", { x: 1 }, 1));

    scopeA.stop();
    b?.set("x", 2);
    expect(b?.state.value).toEqual({ x: 2 });
    scopeB.stop();
  });
});
