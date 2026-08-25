import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignal } from "../../../src/core/signal";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSignal", () => {
  it("reads initial value", () => {
    const s = createSignal(1);
    expect(s.value).toBe(1);
  });

  it("notifies with new/old value and skips identical set by default", () => {
    const s = createSignal(1);
    const cb = vi.fn();
    s.subscribe(cb);
    s.set(2);
    expect(cb).toHaveBeenCalledWith(2, 1);
    s.set(2); // Object.is equal → no notify
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("always-equality notifies even for identical reference", () => {
    const obj = { a: 1 };
    const s = createSignal(obj, { equality: "always" });
    const cb = vi.fn();
    s.subscribe(cb);
    obj.a = 2;
    s.set(obj);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe isolates listeners; a throwing listener does not break others", () => {
    const s = createSignal(0);
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const off = s.subscribe(bad);
    s.subscribe(good);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    s.set(1);
    expect(good).toHaveBeenCalledWith(1, 0);
    off();
    s.set(2);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });

  it("unsubscribing another listener during notification is safe", () => {
    const s = createSignal(0);
    const cbB = vi.fn();
    let offB!: () => void;
    const cbA = vi.fn(() => {
      offB();
    });
    offB = s.subscribe(cbB);
    s.subscribe(cbA);
    s.set(1);
    expect(cbB).toHaveBeenCalledWith(1, 0);
    s.set(2);
    expect(cbB).toHaveBeenCalledTimes(1);
    expect(cbA).toHaveBeenCalledTimes(2);
  });

  it("unsubscribing during own notification is safe", () => {
    const s = createSignal(0);
    let calls = 0;
    let off!: () => void;
    off = s.subscribe(() => {
      calls++;
      if (calls === 1) off();
    });
    s.set(1);
    s.set(2);
    expect(calls).toBe(1);
  });

  it("synchronous re-entrant set converges to the final value without overflow", () => {
    const s = createSignal(0);
    const seen: number[] = [];
    let depth = 0;
    s.subscribe((v) => {
      seen.push(v);
      if (depth < 3) {
        depth++;
        s.set(v + 1);
      }
    });
    expect(() => s.set(1)).not.toThrow();
    expect(seen[seen.length - 1]).toBe(4);
    expect(s.value).toBe(4);
  });

  it("first subscriber receives oldVal as the initial value on first notification", () => {
    const s = createSignal("a");
    const cb = vi.fn();
    s.subscribe(cb);
    s.set("b");
    expect(cb).toHaveBeenCalledWith("b", "a");
  });
});
