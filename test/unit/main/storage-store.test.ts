import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { FakeIpcEvent, FakeWebContents } from "./helpers/electron-impl";

vi.mock("electron", async () => {
  const m = await import("./helpers/electron-impl");
  return { ...m.electronMock };
});

// fs spies wrap the real implementation; retry tests override with
// mockImplementationOnce queues, everything else hits the real tmp fs.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile),
    rename: vi.fn(actual.rename),
  };
});

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { writeFile as realWriteFileCb } from "node:fs";
import { promisify } from "node:util";

const realWriteFile = promisify(realWriteFileCb) as (
  ...args: Parameters<(typeof import("node:fs/promises"))["writeFile"]>
) => Promise<void>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let h: typeof import("./helpers/electron-impl");
let Store: typeof import("../../../src/main/storage-store").StorageStore;
let fsSpy: { writeFile: Mock; rename: Mock };
let userData: string;

async function fresh(): Promise<void> {
  vi.resetModules();
  h = await import("./helpers/electron-impl");
  userData = h.resetElectronMock();
  const storeMod = await import("../../../src/main/storage-store");
  Store = storeMod.StorageStore;
  fsSpy = (await import("node:fs/promises")) as unknown as { writeFile: Mock; rename: Mock };
  await h.flushIpcSetup();
}

async function readStoreFile(name: string): Promise<Record<string, unknown>> {
  const raw = await readFile(join(userData, "cross-window-state", `${name}.json`), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

beforeEach(async () => {
  vi.useRealTimers();
  await fresh();
});

describe("StorageStore construction", () => {
  it("creates the file on first use with {version,data,updatedAt} and isNew=true", async () => {
    const store = new Store("settings", { theme: "light" }, 1);
    expect(store.isNew).toBe(true);
    // first write is immediate (not debounced)
    const onDisk = await readStoreFile("settings");
    expect(onDisk.version).toBe(1);
    expect(onDisk.data).toEqual({ theme: "light" });
    expect(typeof onDisk.updatedAt).toBe("string");
  });

  it("merges persisted data over defaults when version matches", async () => {
    const first = new Store("settings", { theme: "light", lang: "en" }, 1);
    first.set("theme", "dark");
    first.destroy();

    const second = new Store("settings", { theme: "light", lang: "en" }, 1);
    expect(second.isNew).toBe(false);
    expect(second.state.theme).toBe("dark");
    expect(second.state.lang).toBe("en"); // default fills non-persisted key
    second.destroy();
  });

  it("returns the existing instance for same name+version+defaults", () => {
    const a = new Store("settings", { theme: "light" }, 1);
    const b = new Store("settings", { theme: "light" }, 1);
    expect(b).toBe(a);
    a.destroy();
  });

  it("throws when defaults differ and skipDefaultsCheck is not set", () => {
    const a = new Store("settings", { theme: "light" }, 1);
    expect(() => new Store("settings", { theme: "dark" }, 1)).toThrow(/defaults/i);
    a.destroy();
  });

  it("reuses the instance with different defaults when skipDefaultsCheck is set", () => {
    const a = new Store("settings", { theme: "light" }, 1);
    const b = new Store("settings", { theme: "dark" }, 1, { skipDefaultsCheck: true });
    expect(b).toBe(a);
    a.destroy();
  });

  it("rejects invalid names", () => {
    expect(() => new Store("bad/name", {}, 1)).toThrow(/name/i);
  });
});

describe("StorageStore version migration", () => {
  async function seedV1(): Promise<void> {
    const v1 = new Store<Record<string, unknown>>("settings", { a: 1, b: "x", c: true }, 1);
    v1.set("c", "corrupted-type");
    v1.set("gone", "old-field");
    v1.destroy();
  }

  it("upgrade: adds new keys, removes gone keys, resets type-changed keys", async () => {
    await seedV1();
    const v2 = new Store("settings", { a: 1, b: "x", c: true, fresh: "new" }, 2);

    expect(v2.state.a).toBe(1); // kept
    expect(v2.state.b).toBe("x"); // kept
    expect(v2.state.c).toBe(true); // type changed → reset to default
    expect(v2.state.fresh).toBe("new"); // added → default
    expect("gone" in v2.state).toBe(false); // removed from defaults → deleted
    expect(v2.version).toBe(2);

    v2.destroy();
    const onDisk = await readStoreFile("settings");
    expect(onDisk.version).toBe(2);
    expect(onDisk.data).toEqual({ a: 1, b: "x", c: true, fresh: "new" });
  });

  it("corrupted JSON falls back to defaults without throwing", async () => {
    const first = new Store("settings", { theme: "light" }, 1);
    const file = join(userData, "cross-window-state", "settings.json");
    first.destroy();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "{not json", "utf-8");

    const second = new Store("settings", { theme: "light" }, 1);
    expect(second.state.theme).toBe("light");
    second.destroy();

    // repaired on disk immediately
    const onDisk = await readStoreFile("settings");
    expect(onDisk.data).toEqual({ theme: "light" });
  });

  it("stored version higher than code version (downgrade) migrates against code defaults", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(join(userData, "cross-window-state"), { recursive: true });
    const file = join(userData, "cross-window-state", "settings.json");
    await writeFile(
      file,
      JSON.stringify({
        version: 9,
        data: { a: 1, stale: "x" },
        updatedAt: "2020-01-01T00:00:00.000Z",
      }),
      "utf-8",
    );

    const store = new Store("settings", { a: 1, fresh: true }, 2);
    expect(store.state.a).toBe(1);
    expect(store.state.fresh).toBe(true);
    expect("stale" in store.state).toBe(false);
    store.destroy();

    const onDisk = await readStoreFile("settings");
    expect(onDisk.version).toBe(2);
  });

  it("same version but stored data missing some defaults gets them merged in", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(join(userData, "cross-window-state"), { recursive: true });
    await writeFile(
      join(userData, "cross-window-state", "settings.json"),
      JSON.stringify({ version: 1, data: { a: 5 }, updatedAt: "2020-01-01T00:00:00.000Z" }),
      "utf-8",
    );
    const store = new Store("settings", { a: 0, extra: "d" }, 1);
    expect(store.state.a).toBe(5);
    expect(store.state.extra).toBe("d");
    store.destroy();
  });
});

describe("StorageStore set / watch / proxy writes", () => {
  it("set(key, value) updates state, notifies key watchers and root subscribers", () => {
    const store = new Store("settings", { theme: "light", count: 0 }, 1);
    const seen: unknown[] = [];
    const roots: Array<Record<string, unknown>> = [];
    store.watch("theme", (v) => seen.push(v));
    store.subscribe((data) => roots.push(data));

    store.set("theme", "dark");
    expect(store.state.theme).toBe("dark");
    expect(seen).toEqual(["dark"]);
    expect(roots.length).toBe(1);
    expect(roots[0]?.theme).toBe("dark");

    store.set({ count: 3 });
    expect(store.state.count).toBe(3);
    expect(roots.length).toBe(2);
    store.destroy();
  });

  it("proxy write s.state.k = v behaves like set (signal + notify)", () => {
    const store = new Store("settings", { theme: "light" }, 1);
    const seen: unknown[] = [];
    store.watch("theme", (v) => seen.push(v));

    store.state.theme = "dark";
    expect(store.state.theme).toBe("dark");
    expect(seen).toEqual(["dark"]);
    store.destroy();
  });

  it("watch unsubscribe works", () => {
    const store = new Store("settings", { theme: "light" }, 1);
    const seen: unknown[] = [];
    const off = store.watch("theme", (v) => seen.push(v));
    store.set("theme", "dark");
    off();
    store.set("theme", "blue");
    expect(seen).toEqual(["dark"]);
    store.destroy();
  });
});

describe("StorageStore persistence (debounced + atomic)", () => {
  it("debounces: 10 rapid sets produce one write with the final value", async () => {
    const store = new Store("settings", { count: 0 }, 1);
    fsSpy.writeFile.mockClear();
    fsSpy.rename.mockClear();

    for (let i = 1; i <= 10; i++) store.set("count", i);

    // nothing written yet (inside the debounce window)
    expect(fsSpy.writeFile).not.toHaveBeenCalled();
    await sleep(450);

    // exactly one tmp write + rename for the whole burst
    expect(fsSpy.writeFile).toHaveBeenCalledTimes(1);
    expect(fsSpy.rename).toHaveBeenCalledTimes(1);

    const onDisk = await readStoreFile("settings");
    expect(onDisk.data).toEqual({ count: 10 });
    store.destroy();
  });

  it("writes via tmp file + rename (atomic), direct-write fallback when rename fails", async () => {
    const store = new Store("settings", { count: 0 }, 1);
    fsSpy.writeFile.mockClear();
    fsSpy.rename.mockClear();

    store.set("count", 5);
    await new Promise((r) => setTimeout(r, 400));

    expect(fsSpy.rename.mock.calls.length).toBeGreaterThanOrEqual(1);
    const onDisk = await readStoreFile("settings");
    expect(onDisk.data).toEqual({ count: 5 });
    store.destroy();

    // rename fails → direct write to the target path still lands
    fsSpy.rename.mockImplementationOnce(async () => {
      throw new Error("rename blocked");
    });
    const store2 = new Store("settings2", { x: 1 }, 1);
    store2.set("x", 2);
    await new Promise((r) => setTimeout(r, 400));
    const onDisk2 = await readStoreFile("settings2");
    expect(onDisk2.data).toEqual({ x: 2 });
    store2.destroy();
  });

  it("retries failed writes and succeeds; exhausted retries throw but memory keeps the value", async () => {
    const store = new Store("settings", { count: 0 }, 1, { maxRetries: 3, retryDelay: 20 });
    fsSpy.writeFile.mockClear();

    let failures = 0;
    fsSpy.writeFile.mockImplementation(async (...args: unknown[]) => {
      failures++;
      if (failures <= 2) throw new Error("disk busy");
      return realWriteFile(
        ...(args as Parameters<(typeof import("node:fs/promises"))["writeFile"]>),
      );
    });

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    store.set("count", 7);
    await vi.waitFor(
      async () => {
        const onDisk = await readStoreFile("settings");
        expect(onDisk.data).toEqual({ count: 7 });
      },
      { timeout: 3000 },
    );
    expect(store.state.count).toBe(7);
    expect(errSpy).not.toHaveBeenCalled();

    // now exhaust: every write fails
    let attempts = 0;
    fsSpy.writeFile.mockImplementation(async () => {
      attempts++;
      throw new Error("disk dead");
    });
    store.set("count", 9);
    await sleep(600);
    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(store.state.count).toBe(9); // memory intact
    errSpy.mockRestore();

    store.destroy();
    fsSpy.writeFile.mockRestore();
  });

  it("destroy flushes pending debounced writes immediately", async () => {
    const store = new Store("settings", { count: 0 }, 1);
    fsSpy.writeFile.mockClear();

    store.set("count", 42);
    store.destroy(); // no timer wait

    const onDisk = await readStoreFile("settings");
    expect(onDisk.data).toEqual({ count: 42 });
  });
});

describe("StorageStore renderer coordination", () => {
  it("getByRenderer registers the sender and returns merged state", () => {
    const store = new Store("settings", { theme: "light" }, 1);
    const wc: FakeWebContents = h.makeFakeWebContents(3);
    const event: FakeIpcEvent = { sender: wc };

    const state = store.getByRenderer(event.sender.id);
    expect(state).toEqual({ theme: "light" });

    store.set("theme", "dark");
    expect(wc.send).toHaveBeenCalled();
    store.destroy();
  });

  it("notifyRenderers prunes destroyed webContents", () => {
    const store = new Store("settings", { theme: "light" }, 1);
    const wc = h.makeFakeWebContents(3);
    store.getByRenderer(3);
    wc.destroyed = true;

    store.set("theme", "dark");
    expect(wc.send).not.toHaveBeenCalled();
    store.destroy();
  });

  it("setByRenderer applies the patch like a local set", () => {
    const store = new Store("settings", { theme: "light" }, 1);
    store.setByRenderer({ theme: "dark" }, "theme");
    expect(store.state.theme).toBe("dark");
    store.destroy();
  });
});
