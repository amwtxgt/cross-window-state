import { describe, expect, it } from "vitest";
import { channel, runtimeUpdateChannel, storageUpdateChannel } from "../../../src/core/protocol";

describe("IPC protocol", () => {
  it("prefixes every channel with the cws: namespace", () => {
    for (const name of Object.values(channel)) {
      expect(name.startsWith("cws:")).toBe(true);
    }
  });

  it("exposes invoke channels for runtime and storage", () => {
    expect(channel.runtimeSet).toBe("cws:runtime:set");
    expect(channel.runtimeGet).toBe("cws:runtime:get");
    expect(channel.runtimeClear).toBe("cws:runtime:clear");
    expect(channel.storageGet).toBe("cws:storage:get");
    expect(channel.storageSet).toBe("cws:storage:set");
  });

  it("builds per-key runtime update channels", () => {
    expect(runtimeUpdateChannel("theme")).toBe("cws:runtime:update:theme");
  });

  it("builds per-key storage update channels", () => {
    expect(storageUpdateChannel("settings", "theme")).toBe("cws:storage:update:settings:theme");
  });

  it("builds whole-state storage update channels (reserved)", () => {
    expect(storageUpdateChannel("settings")).toBe("cws:storage:update:settings");
  });
});
