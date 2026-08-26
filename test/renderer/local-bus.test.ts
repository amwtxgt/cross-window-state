import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageGetPayload } from "../../src/core/protocol";

/**
 * Deterministic BroadcastChannel double: postMessage delivers synchronously
 * to every same-name channel except the sender (matching the real
 * "no echo to sender" semantics). Closing in afterEach prevents cross-test
 * message leaks — the real Node BroadcastChannel is process-global.
 */
class FakeBroadcastChannel {
  static instances = new Set<FakeBroadcastChannel>();
  readonly name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  listeners: Array<(event: { data: unknown }) => void> = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.add(this);
  }

  addEventListener(_type: string, cb: (event: { data: unknown }) => void): void {
    this.listeners.push(cb);
  }

  postMessage(message: unknown): void {
    for (const inst of FakeBroadcastChannel.instances) {
      if (inst !== this && inst.name === this.name) {
        inst.onmessage?.({ data: message });
        for (const cb of inst.listeners) cb({ data: message });
      }
    }
  }

  close(): void {
    FakeBroadcastChannel.instances.delete(this);
  }
}

vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

type BusModule = typeof import("../../src/renderer/local-bus");

/** Load a fresh module instance (= a new tab): own memory, shared
 *  localStorage + BroadcastChannel domain. */
async function loadTab(): Promise<BusModule> {
  vi.resetModules();
  return await import("../../src/renderer/local-bus");
}

function flushBus(): void {
  // delivery is synchronous with the fake; nothing to await
}

function payload(defaults: Record<string, unknown>, version: number): StorageGetPayload {
  return { defaults, version };
}

beforeEach(() => {
  for (const ch of FakeBroadcastChannel.instances) ch.close();
  FakeBroadcastChannel.instances.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.resetModules();
});

describe("localRuntimeBus", () => {
  it("get returns undefined for unknown keys; set stores and get returns the value", async () => {
    const bus = await loadTab();
    expect(bus.localRuntimeBus.get("theme")).toBeUndefined();
    bus.localRuntimeBus.set("theme", "dark");
    expect(bus.localRuntimeBus.get("theme")).toBe("dark");
  });

  it("set notifies local listeners synchronously (loopback without channel echo)", async () => {
    const bus = await loadTab();
    const seen: unknown[] = [];
    bus.localRuntimeBus.onStateUpdated("theme", (p) => seen.push(p.newValue));
    bus.localRuntimeBus.set("theme", "dark");
    expect(seen).toEqual(["dark"]);
  });

  it("unsubscribe stops notifications", async () => {
    const bus = await loadTab();
    const seen: unknown[] = [];
    const off = bus.localRuntimeBus.onStateUpdated("theme", (p) => seen.push(p.newValue));
    bus.localRuntimeBus.set("theme", "dark");
    off();
    bus.localRuntimeBus.set("theme", "blue");
    expect(seen).toEqual(["dark"]);
  });

  it("clear removes the value and notifies local listeners with undefined", async () => {
    const bus = await loadTab();
    const seen: unknown[] = [];
    bus.localRuntimeBus.set("theme", "dark");
    bus.localRuntimeBus.onStateUpdated("theme", (p) => seen.push(p.newValue));
    bus.localRuntimeBus.clear("theme");
    expect(bus.localRuntimeBus.get("theme")).toBeUndefined();
    expect(seen).toEqual([undefined]);
  });

  it("clear is local-only: a sibling tab keeps its state", async () => {
    const a = await loadTab();
    const b = await loadTab();
    const seenB: unknown[] = [];
    b.localRuntimeBus.onStateUpdated("theme", (p) => seenB.push(p.newValue));
    a.localRuntimeBus.set("theme", "dark");
    flushBus();

    a.localRuntimeBus.clear("theme");
    expect(b.localRuntimeBus.get("theme")).toBe("dark");
    expect(seenB).toEqual(["dark"]);
  });
});

describe("localStorageBus", () => {
  it("get merges defaults with persisted data when the version matches", async () => {
    const a = await loadTab();
    a.localStorageBus.get("settings", payload({ theme: "light", lang: "en" }, 1));
    a.localStorageBus.set("settings", { theme: "dark" }, "theme");

    const b = await loadTab();
    const state = b.localStorageBus.get("settings", payload({ theme: "light", lang: "en" }, 1));
    expect(state).toEqual({ theme: "dark", lang: "en" });
  });

  it("persisted value survives a full page reload (localStorage key cws:{name})", async () => {
    const a = await loadTab();
    a.localStorageBus.get("settings", payload({ theme: "light" }, 1));
    a.localStorageBus.set("settings", { theme: "dark" }, "theme");
    expect(JSON.parse(localStorage.getItem("cws:settings") ?? "{}")).toMatchObject({
      version: 1,
      data: { theme: "dark" },
    });

    const b = await loadTab();
    expect(b.localStorageBus.get("settings", payload({ theme: "light" }, 1))).toEqual({
      theme: "dark",
    });
  });

  it("version mismatch falls back to defaults (no migration chain on web)", async () => {
    const a = await loadTab();
    a.localStorageBus.get("settings", payload({ theme: "light" }, 1));
    a.localStorageBus.set("settings", { theme: "dark" }, "theme");

    const b = await loadTab();
    expect(b.localStorageBus.get("settings", payload({ theme: "light" }, 2))).toEqual({
      theme: "light",
    });
  });

  it("set accepts a partial patch and persists the merged state", async () => {
    const bus = await loadTab();
    bus.localStorageBus.get("settings", payload({ a: 1, b: 2 }, 1));
    bus.localStorageBus.set("settings", { b: 20, c: 30 });
    const state = bus.localStorageBus.get("settings", payload({ a: 1, b: 2 }, 1));
    expect(state).toEqual({ a: 1, b: 20, c: 30 });
  });

  it("onStateUpdated(key) only receives that key", async () => {
    const bus = await loadTab();
    const themeSeen: unknown[] = [];
    bus.localStorageBus.get("settings", payload({ theme: "light", lang: "en" }, 1));
    bus.localStorageBus.onStateUpdated("settings", "theme", (v) => themeSeen.push(v));

    bus.localStorageBus.set("settings", { theme: "dark" }, "theme");
    bus.localStorageBus.set("settings", { lang: "fr" }, "lang");
    expect(themeSeen).toEqual(["dark"]);
  });
});

describe("cross-tab sync via BroadcastChannel", () => {
  it("runtime: tab A set → tab B listener receives the value", async () => {
    const a = await loadTab();
    const b = await loadTab();
    const seen: unknown[] = [];
    b.localRuntimeBus.onStateUpdated("theme", (p) => seen.push(p.newValue));

    a.localRuntimeBus.set("theme", "dark");
    flushBus();
    expect(seen).toEqual(["dark"]);
  });

  it("runtime: a late-joining tab hydrates the current value from a live peer", async () => {
    const a = await loadTab();
    a.localRuntimeBus.onStateUpdated("counter", () => {});
    a.localRuntimeBus.set("counter", 4);

    // B opens later: its first subscription asks peers, A answers with 4.
    const b = await loadTab();
    const seen: unknown[] = [];
    b.localRuntimeBus.onStateUpdated("counter", (p) => seen.push(p.newValue));
    flushBus();
    expect(b.localRuntimeBus.get("counter")).toBe(4);
    expect(seen).toEqual([4]);
  });

  it("runtime: hydration with no peer holding a value leaves the default in place", async () => {
    const a = await loadTab();
    a.localRuntimeBus.onStateUpdated("fresh", () => {});

    const b = await loadTab();
    b.localRuntimeBus.onStateUpdated("fresh", () => {});
    flushBus();
    expect(b.localRuntimeBus.get("fresh")).toBeUndefined();
  });

  it("runtime: identical hydrate replies from several peers apply once", async () => {
    const a = await loadTab();
    a.localRuntimeBus.onStateUpdated("counter", () => {});
    a.localRuntimeBus.set("counter", 7);
    const c = await loadTab();
    c.localRuntimeBus.onStateUpdated("counter", () => {}); // C hydrates 7 from A
    flushBus();

    // Now A and C both hold 7; B's request gets two identical replies.
    const b = await loadTab();
    const seen: unknown[] = [];
    b.localRuntimeBus.onStateUpdated("counter", (p) => seen.push(p.newValue));
    flushBus();
    expect(seen).toEqual([7]);
  });

  it("runtime: a stale hydrate reply never overwrites a value the tab set meanwhile", async () => {
    const a = await loadTab();
    a.localRuntimeBus.onStateUpdated("counter", () => {});
    a.localRuntimeBus.set("counter", 4);

    const b = await loadTab();
    b.localRuntimeBus.onStateUpdated("counter", () => {}); // hydrates 4 from A
    flushBus();
    b.localRuntimeBus.set("counter", 10); // local write AFTER hydrating

    // A slow/duplicate peer's reply for the earlier request arrives late —
    // it must not roll the tab back to 4.
    const ch = new FakeBroadcastChannel("cws:bus");
    ch.postMessage({ kind: "runtime-hydrate", name: "counter", value: 4 });
    flushBus();
    expect(b.localRuntimeBus.get("counter")).toBe(10);
  });

  it("storage: tab A set → tab B listener + persisted state updated", async () => {
    const a = await loadTab();
    const b = await loadTab();
    a.localStorageBus.get("settings", payload({ theme: "light" }, 1));
    b.localStorageBus.get("settings", payload({ theme: "light" }, 1));

    const seen: unknown[] = [];
    b.localStorageBus.onStateUpdated("settings", "theme", (v) => seen.push(v));
    a.localStorageBus.set("settings", { theme: "dark" }, "theme");

    flushBus();
    expect(seen).toEqual(["dark"]);
    // B's own bus reflects the merged state
    expect(b.localStorageBus.get("settings", payload({ theme: "light" }, 1))).toEqual({
      theme: "dark",
    });
  });

  it("regression: a broadcast arriving before tab B ever called get keeps the writer version in localStorage", async () => {
    const a = await loadTab();
    a.localStorageBus.get("settings", payload({ theme: "light" }, 4));
    a.localStorageBus.set("settings", { theme: "dark" }, "theme");

    // tab B receives the broadcast without ever calling get()
    const b = await loadTab();
    const seen: unknown[] = [];
    b.localStorageBus.onStateUpdated("settings", "theme", (v) => seen.push(v));
    // trigger another change from A so B applies a patch
    a.localStorageBus.set("settings", { theme: "blue" }, "theme");
    flushBus();
    expect(seen).toEqual(["blue"]);

    // version must still be the writer's (4), not undefined/1
    const persisted = JSON.parse(localStorage.getItem("cws:settings") ?? "{}");
    expect(persisted.version).toBe(4);
  });
});

describe("adversarial hardening", () => {
  it("garbage broadcast messages are ignored without throwing", async () => {
    const bus = await loadTab();
    const seen: unknown[] = [];
    bus.localRuntimeBus.onStateUpdated("theme", (p) => seen.push(p.newValue));
    bus.localStorageBus.get("settings", payload({ theme: "light" }, 1));

    const raw = new BroadcastChannel("cws:bus");
    raw.postMessage(null);
    raw.postMessage("string");
    raw.postMessage(42);
    raw.postMessage({}); // no kind
    raw.postMessage({ kind: "unknown" });
    raw.postMessage({ kind: "runtime" }); // no name
    raw.postMessage({ kind: "runtime", name: "other", value: 1 }); // unknown key: harmless
    raw.postMessage({ kind: "storage", name: "settings" }); // no patch
    flushBus();

    expect(seen).toEqual([]);
  });

  it("localStorage.setItem throwing keeps memory state and set() does not throw", async () => {
    const bus = await loadTab();
    bus.localStorageBus.get("settings", payload({ theme: "light" }, 1));
    const seen: unknown[] = [];
    bus.localStorageBus.onStateUpdated("settings", "theme", (v) => seen.push(v));

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => bus.localStorageBus.set("settings", { theme: "dark" }, "theme")).not.toThrow();
    expect(seen).toEqual(["dark"]);
    spy.mockRestore();

    // memory state intact even though nothing hit disk
    expect(bus.localStorageBus.get("settings", payload({ theme: "light" }, 1))).toEqual({
      theme: "dark",
    });
  });

  it("corrupted persisted JSON is treated as absent", async () => {
    localStorage.setItem("cws:settings", "{broken");
    const bus = await loadTab();
    expect(bus.localStorageBus.get("settings", payload({ theme: "light" }, 1))).toEqual({
      theme: "light",
    });
  });
});
