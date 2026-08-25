import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// Behavior-level ipcRenderer mock: `registered` mirrors the real listener
// registry so tests assert that off() actually removes the wrapper (not just
// that off() was called).
const h = vi.hoisted(() => {
  type Listener = (event: unknown, ...args: unknown[]) => void;
  const registered = new Map<string, Set<Listener>>();
  const exposed = new Map<string, unknown>();
  function add(ch: string, cb: Listener): void {
    let set = registered.get(ch);
    if (!set) {
      set = new Set();
      registered.set(ch, set);
    }
    set.add(cb);
  }
  return {
    registered,
    exposed,
    add,
    listenersOf(ch: string): Listener[] {
      return [...(registered.get(ch) ?? [])];
    },
  };
});

vi.mock("electron", () => ({
  ipcRenderer: {
    on: (ch: string, cb: (event: unknown, ...args: unknown[]) => void) => h.add(ch, cb),
    off: (ch: string, cb: (event: unknown, ...args: unknown[]) => void) => {
      h.registered.get(ch)?.delete(cb);
    },
    send: vi.fn(),
    sendSync: vi.fn(() => null),
  },
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => {
      h.exposed.set(key, value);
    },
  },
}));

import { ipcRenderer } from "electron";
import "../../../src/preload/index";

const sendMock = vi.mocked(ipcRenderer.send);
const sendSyncMock = vi.mocked(ipcRenderer.sendSync) as unknown as Mock;

interface ExposedBridge {
  runtime: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    clear(key: string): void;
    onStateUpdated(key: string, cb: (payload: unknown) => void): () => void;
  };
  storage: {
    get(name: string, payload: unknown): unknown;
    set(name: string, patch: Record<string, unknown>, key?: string): void;
    onStateUpdated(name: string, key: string, cb: (value: unknown) => void): () => void;
  };
}

let bridge: ExposedBridge;

beforeEach(() => {
  bridge = h.exposed.get("__crossWindowState__") as ExposedBridge;
  expect(bridge).toBeTruthy();
  sendMock.mockClear();
  sendSyncMock.mockClear();
});

describe("preload bridge", () => {
  it("exposes runtime and storage under __crossWindowState__", () => {
    expect(bridge.runtime).toBeTruthy();
    expect(bridge.storage).toBeTruthy();
  });

  it("runtime.get sendSyncs on cws:runtime:get and returns the value", () => {
    sendSyncMock.mockReturnValueOnce("dark");
    expect(bridge.runtime.get("theme")).toBe("dark");
    expect(sendSyncMock).toHaveBeenCalledWith("cws:runtime:get", "theme");
  });

  it("runtime.set / clear send on their channels", () => {
    bridge.runtime.set("theme", "dark");
    expect(sendMock).toHaveBeenCalledWith("cws:runtime:set", "theme", "dark");
    bridge.runtime.clear("theme");
    expect(sendMock).toHaveBeenCalledWith("cws:runtime:clear", "theme");
  });

  it("runtime.onStateUpdated: off removes the registered wrapper (regression — off used to pass the raw callback and never unsubscribe)", () => {
    const before = h.listenersOf("cws:runtime:update:theme").length;
    const cb = vi.fn();
    const off = bridge.runtime.onStateUpdated("theme", cb);
    expect(h.listenersOf("cws:runtime:update:theme").length).toBe(before + 1);

    off();
    // the exact wrapper registered by on() must be gone — the old bug passed
    // `cb` itself to off(), which matched nothing and leaked the listener
    expect(h.listenersOf("cws:runtime:update:theme").length).toBe(before);
  });

  it("runtime broadcast reaches the subscribed callback with the payload", () => {
    const cb = vi.fn();
    bridge.runtime.onStateUpdated("theme", cb);
    for (const fn of h.listenersOf("cws:runtime:update:theme")) {
      fn({}, { key: "theme", newValue: "dark", oldValue: "light" });
    }
    expect(cb).toHaveBeenCalledWith({ key: "theme", newValue: "dark", oldValue: "light" });
  });

  it("storage.get sendSyncs name + payload", () => {
    sendSyncMock.mockReturnValueOnce({ a: 1 });
    const payload = { defaults: { a: 1 }, version: 2 };
    expect(bridge.storage.get("settings", payload)).toEqual({ a: 1 });
    expect(sendSyncMock).toHaveBeenCalledWith("cws:storage:get", "settings", payload);
  });

  it("storage.set sends name, patch (and key when provided)", () => {
    bridge.storage.set("settings", { theme: "dark" }, "theme");
    expect(sendMock).toHaveBeenCalledWith(
      "cws:storage:set",
      "settings",
      { theme: "dark" },
      "theme",
    );
    bridge.storage.set("settings", { x: 1 });
    expect(sendMock).toHaveBeenCalledWith("cws:storage:set", "settings", { x: 1 }, undefined);
  });

  it("storage.onStateUpdated registers only the key-level channel and off unsubscribes", () => {
    const ch = "cws:storage:update:settings:theme";
    const before = h.listenersOf(ch).length;
    const cb = vi.fn();
    const off = bridge.storage.onStateUpdated("settings", "theme", cb);
    expect(h.listenersOf(ch).length).toBe(before + 1);

    // delivery while subscribed
    for (const fn of h.listenersOf(ch)) fn({}, "dark");
    expect(cb).toHaveBeenCalledWith("dark");

    off();
    expect(h.listenersOf(ch).length).toBe(before);
  });
});
