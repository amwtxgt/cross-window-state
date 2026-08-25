import { beforeEach, vi } from "vitest";
import { runStateApiContractSuite } from "../../contract/state-api.contract";
import type { ContractFactories } from "../../contract/state-api.contract";

vi.mock("electron", async () => {
  const m = await import("./helpers/electron-impl");
  return { ...m.electronMock };
});

let mod: typeof import("../../../src/main/index");

beforeEach(async () => {
  vi.resetModules();
  const h = await import("./helpers/electron-impl");
  h.resetElectronMock();
  mod = await import("../../../src/main/index");
  await h.flushIpcSetup();
});

runStateApiContractSuite("main", () => {
  return mod as unknown as ContractFactories;
});
