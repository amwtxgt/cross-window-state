/**
 * Seed a v1-shaped settings file so the next app launch performs the
 * versioned migration to the current schema (keeps `theme`/`fontScale`,
 * drops `legacyOption`, adds the keys introduced since: `compact`, `locale`).
 *
 *   node scripts/seed-v1-settings.mjs /tmp/cws-demo
 *   CWS_USER_DATA=/tmp/cws-demo pnpm start
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/seed-v1-settings.mjs <userDataDir>");
  process.exit(1);
}

const stateDir = join(dir, "cross-window-state");
mkdirSync(stateDir, { recursive: true });

// The exact shape the v1 app wrote: no `compact`, plus a since-removed key.
const v1 = {
  version: 1,
  data: { theme: "dark", fontScale: "large", legacyOption: true },
  updatedAt: new Date().toISOString(),
};

const file = join(stateDir, "notes-settings.json");
writeFileSync(file, JSON.stringify(v1, null, 2));
console.log("seeded v1 settings →", file);
console.log("launch the app with CWS_USER_DATA=" + dir + " and watch it migrate to v2");
