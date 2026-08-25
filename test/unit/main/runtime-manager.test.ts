import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  electronMock,
  flushIpcSetup,
  invokeHandler,
  makeFakeWebContents,
  makeIpcEvent,
  resetElectronMock,
} from "./helpers/electron-impl";
import { channel, runtimeUpdateChannel } from "../../../src/core/protocol";

vi.mock("electron", async () => {
  const m = await import("./helpers/electron-impl");
  return { ...m.electronMock };
});

import { RuntimeStateManager } from "../../../src/main/runtime-manager";

let manager: RuntimeStateManager;

beforeEach(async () => {
  resetElectronMock();
  manager = new RuntimeStateManager();
  await flushIpcSetup();
});

describe("RuntimeStateManager acquire/release", () => {
  it("counts references: two acquires need two releases before cleanup", () => {
    const s1 = manager.acquire("theme", "light");
    const s2 = manager.acquire("theme", "light");
    manager.release("theme");
    s1.set("dark");
    expect(s2.value).toBe("dark");
    manager.release("theme");
    expect(manager.get("theme")).toBeUndefined();
  });

  it("second acquire reuses the existing signal (value not reset to new default)", () => {
    const s1 = manager.acquire("theme", "light");
    s1.set("dark");
    const s2 = manager.acquire("theme", "ignored-default");
    expect(s2.value).toBe("dark");
  });

  it("get on a never-set key returns undefined without leaking a signal entry", () => {
    expect(manager.get("nope")).toBeUndefined();
    manager.set("nope", undefined as unknown);
    expect(manager.get("nope")).toBeUndefined();
  });
});

describe("RuntimeStateManager.set broadcasts", () => {
  it("sends {key,newValue,oldValue} to registered webContents on the update channel", () => {
    manager.acquire("theme", "light");
    const wc = makeFakeWebContents(7);
    invokeHandler(channel.runtimeGet, makeIpcEvent(7), "theme");

    manager.set("theme", "dark");

    expect(wc.send).toHaveBeenCalledTimes(1);
    const [ch, payload] = wc.send.mock.calls[0] as [string, unknown];
    expect(ch).toBe(runtimeUpdateChannel("theme"));
    expect(payload).toEqual({ key: "theme", newValue: "dark", oldValue: "light" });
  });

  it("does not broadcast when no renderer registered", () => {
    manager.acquire("theme", "light");
    const wc = makeFakeWebContents(9);
    manager.set("theme", "dark");
    expect(wc.send).not.toHaveBeenCalled();
  });

  it("prunes destroyed webContents during broadcast", () => {
    const wc = makeFakeWebContents(7);
    invokeHandler(channel.runtimeGet, makeIpcEvent(7), "theme");
    wc.destroyed = true;

    manager.set("theme", 1);
    expect(wc.send).not.toHaveBeenCalled();

    // id was pruned: a revived webContents object with same id is not called again
    const wc2 = makeFakeWebContents(7);
    manager.set("theme", 2);
    expect(wc2.send).not.toHaveBeenCalled();
  });

  it("swallows send errors and prunes the offending id", () => {
    const wc = makeFakeWebContents(7);
    wc.send.mockImplementation(() => {
      throw new Error("gone");
    });
    invokeHandler(channel.runtimeGet, makeIpcEvent(7), "theme");
    expect(() => manager.set("theme", "x")).not.toThrow();
    expect(wc.send).toHaveBeenCalledTimes(1);

    wc.send.mockClear();
    wc.send.mockImplementation(() => {});
    manager.set("theme", "y");
    expect(wc.send).not.toHaveBeenCalled();
  });

  it('falsy old values (0, "", false, null) still notify main-process watchers', () => {
    const s = manager.acquire("count", 0);
    const seen: unknown[] = [];
    s.subscribe((v) => seen.push(v));
    manager.set("count", 5);
    manager.set("count", 0);
    manager.set("count", 5);
    expect(seen).toEqual([5, 0, 5]);
  });

  it("set(key, undefined) clears the state and broadcasts newValue undefined", () => {
    manager.acquire("theme", "light");
    const wc = makeFakeWebContents(3);
    invokeHandler(channel.runtimeGet, makeIpcEvent(3), "theme");

    manager.set("theme", undefined);

    expect(manager.get("theme")).toBeUndefined();
    const payload = wc.send.mock.calls[0]?.[1] as { newValue: unknown };
    expect(payload.newValue).toBeUndefined();
  });
});

describe("RuntimeStateManager IPC handlers", () => {
  it("runtimeGet returns the current value and registers the sender", () => {
    manager.set("theme", "dark");
    const wc = makeFakeWebContents(11);
    const event = makeIpcEvent(11);
    invokeHandler(channel.runtimeGet, event, "theme");
    expect(event.returnValue).toBe("dark");

    manager.set("theme", "light");
    expect(wc.send).toHaveBeenCalled();
  });

  it("runtimeGet registers the same sender only once", () => {
    makeFakeWebContents(11);
    invokeHandler(channel.runtimeGet, makeIpcEvent(11), "theme");
    invokeHandler(channel.runtimeGet, makeIpcEvent(11), "theme");

    const wc = webContentsOf(11);
    manager.set("theme", "x");
    expect(wc.send).toHaveBeenCalledTimes(1);
  });

  it("runtimeSet updates the signal and broadcasts", () => {
    const s = manager.acquire("theme", "light");
    const wc = makeFakeWebContents(4);
    invokeHandler(channel.runtimeGet, makeIpcEvent(4), "theme");

    invokeHandler(channel.runtimeSet, makeIpcEvent(4), "theme", "dark");

    expect(s.value).toBe("dark");
    expect(wc.send).toHaveBeenCalled();
  });

  it("runtimeClear unregisters the sender; zero refs after clear really cleans up", () => {
    const s = manager.acquire("theme", "light");
    const wc = makeFakeWebContents(4);
    invokeHandler(channel.runtimeGet, makeIpcEvent(4), "theme");

    invokeHandler(channel.runtimeClear, makeIpcEvent(4), "theme");
    manager.set("theme", "dark");
    expect(wc.send).not.toHaveBeenCalled(); // unregistered

    manager.release("theme");
    expect(manager.get("theme")).toBeUndefined();
    expect(s.value).toBe("dark"); // released signal keeps last value for its holders
  });

  it("state survives while a main-process ref exists even if all renderers clear", () => {
    const s = manager.acquire("theme", "light");
    s.set("dark");
    invokeHandler(channel.runtimeGet, makeIpcEvent(4), "theme");
    invokeHandler(channel.runtimeClear, makeIpcEvent(4), "theme");
    expect(manager.get("theme")).toBe("dark");
  });
});

function webContentsOf(id: number) {
  return electronMock.webContents.fromId.mock.results.find((r) => r.value?.id === id)?.value;
}
