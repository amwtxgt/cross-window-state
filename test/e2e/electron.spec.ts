import { test, expect, _electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = fileURLToPath(new URL(".", import.meta.url));
const mainJs = join(e2eDir, "..", "..", "examples", "basic", "out", "main", "index.js");

async function launch(userData?: string): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  if (userData) env.CWS_USER_DATA = userData;
  return await _electron.launch({ args: [mainJs], env });
}

async function twoWindows(app: ElectronApplication): Promise<[Page, Page]> {
  // windows appear asynchronously after whenReady
  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  const wins = app.windows();
  return [wins[0]!, wins[1]!];
}

test("runtime counter syncs across both windows in real time", async () => {
  const app = await launch();
  const [a, b] = await twoWindows(app);

  await a.locator("#inc").click();
  await expect(b.locator("#count")).toHaveText("1");

  await b.locator("#inc").click();
  await expect(a.locator("#count")).toHaveText("2");

  await app.close();
});

test("storage settings sync across windows and survive a full restart", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cws-e2e-"));

  const app = await launch(userData);
  const [a, b] = await twoWindows(app);
  await a.locator("#theme").selectOption("dark");
  await expect(b.locator("#settings-view")).toContainText('"dark"');
  await a.locator("#notifications").uncheck();
  await expect(b.locator("#notifications")).not.toBeChecked();
  await app.close();

  const app2 = await launch(userData);
  await expect.poll(() => app2.windows().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  const c = app2.windows()[0]!;
  await expect(c.locator("#theme")).toHaveValue("dark");
  await expect(c.locator("#notifications")).not.toBeChecked();
  await app2.close();
});

test("destroy stops one window’s handle without breaking the other", async () => {
  const app = await launch();
  const [a, b] = await twoWindows(app);

  await a.locator("#inc").click();
  await expect(b.locator("#count")).toHaveText("1");

  await a.locator("#destroy").click();
  await a.locator("#inc").click(); // rejected after destroy
  await expect(a.locator("#count")).toHaveText("1");

  await b.locator("#inc").click(); // sibling still fully alive
  await expect(b.locator("#count")).toHaveText("2");

  await app.close();
});

test("open-new-window button creates a third window that is already in sync", async () => {
  const app = await launch();
  const [a, b] = await twoWindows(app);
  await a.locator("#inc").click();
  await expect(b.locator("#count")).toHaveText("1");

  await a.locator("#open-window").click();
  await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBe(3);

  const third = app.windows().find((w) => w !== a && w !== b);
  expect(third).toBeTruthy();
  await expect(third!.locator("#count")).toHaveText("1");

  await app.close();
});
