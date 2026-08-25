import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeWebContents } from "./helpers/electron-impl";

vi.mock("electron", async () => {
  const m = await import("./helpers/electron-impl");
  return { ...m.electronMock };
});

// The factories bind to a module-level manager singleton, so each test
// re-imports every module (helpers included — they must share one module
// instance with the electron mock) after resetting the registry.
let createRuntimeState: typeof import("../../../src/main/runtime-state").createRuntimeState;
let manager: { get(name: string): unknown };
let h: typeof import("./helpers/electron-impl");

beforeEach(async () => {
  vi.resetModules();
  h = await import("./helpers/electron-impl");
  h.resetElectronMock();
  const runtimeStateMod = await import("../../../src/main/runtime-state");
  const managerMod = await import("../../../src/main/runtime-manager");
  createRuntimeState = runtimeStateMod.createRuntimeState;
  manager = managerMod.runtimeStateManager;
  await h.flushIpcSetup();
});

describe("createRuntimeState (main)", () => {
  it("returns the default value initially", () => {
    const theme = createRuntimeState("theme", "light");
    expect(theme.state).toBe("light");
  });

  it("set updates state, manager value and broadcasts", () => {
    const theme = createRuntimeState("theme", "light");
    const wc: FakeWebContents = h.makeFakeWebContents(2);
    h.invokeHandler("cws:runtime:get", h.makeIpcEvent(2), "theme");

    theme.set("dark");

    expect(theme.state).toBe("dark");
    expect(manager.get("theme")).toBe("dark");
    expect(wc.send).toHaveBeenCalled();
  });

  it("watch receives changes from local set and renderer set", () => {
    const theme = createRuntimeState("theme", "light");
    const seen: string[] = [];
    theme.watch((v) => seen.push(v));

    theme.set("dark");
    h.invokeHandler("cws:runtime:set", h.makeIpcEvent(5), "theme", "blue");

    expect(seen).toEqual(["dark", "blue"]);
  });

  it("destroy releases the manager reference; later sets are ignored", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const theme = createRuntimeState("theme", "light");
    theme.destroy();

    expect(manager.get("theme")).toBeUndefined();

    theme.set("dark");
    expect(theme.state).toBe("light"); // still holds last value, but no-op write
    expect(manager.get("theme")).toBeUndefined();

    theme.watch(() => {});
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("double destroy warns and does not double-release", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const other = createRuntimeState<number>("shared", 1);
    other.destroy();
    other.destroy();
    errSpy.mockRestore();

    // one acquire / one effective release: a second state still works
    const again = createRuntimeState<number>("shared", 2);
    expect(again.state).toBe(2);
    again.destroy();
  });

  it("readonly option rejects set with console.error", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const theme = createRuntimeState("theme", "light", { readonly: true });
    theme.set("dark");
    expect(theme.state).toBe("light");
    expect(manager.get("theme")).toBe("light");
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("two instances of the same name share one underlying state", () => {
    const a = createRuntimeState<number>("count", 0);
    const b = createRuntimeState<number>("count", 0);
    a.set(5);
    expect(b.state).toBe(5);
  });
});
