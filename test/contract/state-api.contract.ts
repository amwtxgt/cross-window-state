import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The main/renderer parity contract (design §2): the exact same behavioral
 * matrix runs against both factories. Any behavioral drift on either side
 * fails CI. This file defines the matrix; the main suite injects the
 * main-process factories (with the electron mock), the renderer suite
 * injects the renderer factories (with a fake preload bridge).
 */

export interface ContractRuntimeState<T> {
  readonly state: T;
  set(value: T): void;
  watch(cb: (newVal: T, oldVal: T | undefined) => void): () => void;
  destroy(): void;
}

export interface ContractStorageState<T extends Record<string, unknown>> {
  readonly state: T;
  set<K extends keyof T & string>(key: K, value: T[K]): void;
  set(patch: Partial<T>): void;
  watch<K extends keyof T & string>(
    key: K,
    cb: (newValue: T[K], oldValue: T[K] | undefined) => void,
  ): () => void;
  destroy(): void;
}

export interface ContractFactories {
  createRuntimeState: <T>(
    name: string,
    defaultValue?: T,
    options?: { readonly?: boolean },
  ) => ContractRuntimeState<T>;
  createStorageState: <T extends Record<string, unknown>>(
    name: string,
    defaults: T,
    version: number,
  ) => ContractStorageState<T>;
}

type MakeFactories = () => ContractFactories;

export function runStateApiContractSuite(label: string, make: MakeFactories): void {
  describe(`state API contract — ${label}`, () => {
    let f: ContractFactories;
    beforeEach(() => {
      f = make();
    });

    // ---- runtime -------------------------------------------------------

    it("runtime: initial state is the default value", () => {
      const theme = f.createRuntimeState("contract-theme", "light");
      expect(theme.state).toBe("light");
    });

    it("runtime: set updates state immediately and fires watch exactly once", () => {
      const theme = f.createRuntimeState("contract-theme", "light");
      const seen: string[] = [];
      theme.watch((v) => seen.push(v));
      theme.set("dark");
      expect(theme.state).toBe("dark");
      expect(seen).toEqual(["dark"]);
    });

    it("runtime: watch unsubscribe stops notifications", () => {
      const theme = f.createRuntimeState("contract-theme", "light");
      const seen: string[] = [];
      const off = theme.watch((v) => seen.push(v));
      theme.set("dark");
      off();
      theme.set("blue");
      expect(seen).toEqual(["dark"]);
    });

    it("runtime: two same-name states share one underlying state", () => {
      const a = f.createRuntimeState("contract-shared", 0);
      const b = f.createRuntimeState("contract-shared", 0);
      a.set(5);
      expect(b.state).toBe(5);
    });

    it("runtime: readonly option rejects set with console.error", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const theme = f.createRuntimeState("contract-theme", "light", { readonly: true });
      theme.set("dark");
      expect(theme.state).toBe("light");
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it("runtime: destroy rejects later set/watch and warns on double destroy", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const theme = f.createRuntimeState("contract-theme", "light");
      theme.destroy();

      theme.set("dark");
      expect(theme.state).toBe("light");
      theme.watch(() => {});
      theme.destroy(); // double

      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    // ---- storage -------------------------------------------------------

    it("storage: initial state equals defaults", () => {
      const settings = f.createStorageState("contract-settings", { theme: "light", count: 0 }, 1);
      expect(settings.state.theme).toBe("light");
      expect(settings.state.count).toBe(0);
    });

    it("storage: set(key, value) updates state and fires that key watcher", () => {
      const settings = f.createStorageState("contract-settings", { theme: "light" }, 1);
      const seen: string[] = [];
      settings.watch("theme", (v) => seen.push(v));
      settings.set("theme", "dark");
      expect(settings.state.theme).toBe("dark");
      expect(seen).toEqual(["dark"]);
    });

    it("storage: set(patch) updates every key in the patch", () => {
      const settings = f.createStorageState("contract-settings", { a: 1, b: 2 }, 1);
      settings.set({ a: 10, b: 20 });
      expect(settings.state.a).toBe(10);
      expect(settings.state.b).toBe(20);
    });

    it("storage: proxy write state.k = v behaves like set (state + watcher)", () => {
      const settings = f.createStorageState("contract-settings", { theme: "light" }, 1);
      const seen: string[] = [];
      settings.watch("theme", (v) => seen.push(v));
      settings.state.theme = "dark";
      expect(settings.state.theme).toBe("dark");
      expect(seen).toEqual(["dark"]);
    });

    it("storage: delete state.k makes the key read undefined", () => {
      const settings = f.createStorageState("contract-settings", { theme: "light" }, 1);
      expect(settings.state.theme).toBe("light");
      delete (settings.state as Record<string, unknown>).theme;
      expect(settings.state.theme).toBeUndefined();
    });

    it("storage: destroy rejects later set/proxy write", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const settings = f.createStorageState("contract-settings", { theme: "light" }, 1);
      settings.destroy();

      settings.set("theme", "dark");
      settings.state.theme = "blue";
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it("storage: same name + version shares one underlying state", () => {
      const a = f.createStorageState("contract-settings", { count: 0 }, 1);
      const b = f.createStorageState("contract-settings", { count: 0 }, 1);
      a.set("count", 9);
      expect(b.state.count).toBe(9);
    });
  });
}
