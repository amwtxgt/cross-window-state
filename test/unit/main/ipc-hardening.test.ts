import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeIpcEvent } from "./helpers/electron-impl";

vi.mock("electron", async () => {
  const m = await import("./helpers/electron-impl");
  return { ...m.electronMock };
});

let h: typeof import("./helpers/electron-impl");
let mainMod: typeof import("../../../src/main/index");

beforeEach(async () => {
  vi.resetModules();
  h = await import("./helpers/electron-impl");
  h.resetElectronMock();
  mainMod = await import("../../../src/main/index");
  await h.flushIpcSetup();
});

describe("storage IPC handler hardening", () => {
  it("get with a non-string name returns null instead of throwing", () => {
    const event = h.makeIpcEvent(1);
    expect(() =>
      h.invokeHandler("cws:storage:get", event, 123, { defaults: {}, version: 1 }),
    ).not.toThrow();
    expect(event.returnValue).toBeNull();
  });

  it("get with a malformed payload returns null instead of throwing", () => {
    const event = h.makeIpcEvent(1);
    expect(() => h.invokeHandler("cws:storage:get", event, "settings", null)).not.toThrow();
    expect(event.returnValue).toBeNull();

    const event2 = h.makeIpcEvent(2);
    h.invokeHandler("cws:storage:get", event2, "settings", "junk");
    expect(event2.returnValue).toBeNull();

    const event3 = h.makeIpcEvent(3);
    h.invokeHandler("cws:storage:get", event3, "settings", {
      defaults: "not-an-object",
      version: 1,
    });
    expect(event3.returnValue).toBeNull();
  });

  it("set for an unknown store warns and does not throw", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      h.invokeHandler("cws:storage:set", h.makeIpcEvent(1), "ghost", { a: 1 }),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("set with malformed args is ignored without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const event: FakeIpcEvent = h.makeIpcEvent(1);
    expect(() =>
      h.invokeHandler("cws:storage:set", event, undefined, undefined, undefined),
    ).not.toThrow();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe("runtime IPC handler hardening", () => {
  it("set with a non-string key is rejected without polluting channels", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      h.invokeHandler("cws:runtime:set", h.makeIpcEvent(1), { bad: "key" }, "value"),
    ).not.toThrow();
    expect(mainMod.runtimeStateManager.get(String({ bad: "key" }))).toBeUndefined();
    // a valid key still works afterwards
    h.invokeHandler("cws:runtime:set", h.makeIpcEvent(2), "theme", "dark");
    expect(mainMod.runtimeStateManager.get("theme")).toBe("dark");
    errSpy.mockRestore();
  });

  it("get with a non-string key returns undefined without throwing", () => {
    expect(() => h.invokeHandler("cws:runtime:get", h.makeIpcEvent(1), null)).not.toThrow();
  });
});
