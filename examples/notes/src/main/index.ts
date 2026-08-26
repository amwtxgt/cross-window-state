import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRuntimeState, createStorageState, SyncArray } from "cross-window-state/main";
import {
  DEFAULT_NOTES,
  DEFAULT_SETTINGS,
  RUNTIME,
  SETTINGS_VERSION,
  STORAGE,
  welcomeNotes,
} from "../shared/notes";
import type { AuditEntry, NotesData, Settings } from "../shared/notes";

// Allow pinning a stable userData dir (migration demo, persistence checks).
if (process.env.CWS_USER_DATA) {
  app.setPath("userData", process.env.CWS_USER_DATA);
}

// Persistent stores — the main process owns the files; every window reads and
// writes the same states through the identical renderer-side factories.
// Note: a first-creation store writes its file synchronously in the
// constructor, so "is this a fresh install?" must be checked BEFORE that.
const notesFile = join(app.getPath("userData"), "cross-window-state", `${STORAGE.notes}.json`);
const firstRun = !existsSync(notesFile);

const settings = createStorageState<Settings>(STORAGE.settings, DEFAULT_SETTINGS, SETTINGS_VERSION);
const notes = createStorageState<NotesData>(STORAGE.notes, DEFAULT_NOTES, 1);

// Runtime states live in memory and are shared with all windows.
const clock = createRuntimeState<string>(RUNTIME.clock, new Date().toISOString());
const audit = new SyncArray<AuditEntry>(createRuntimeState<AuditEntry[]>(RUNTIME.audit, []), []);

function log(action: string, detail: string): void {
  audit.push({ at: new Date().toISOString(), action, detail });
  if (audit.length > 20) audit.splice(0, audit.length - 20);
  console.log(`[main] ${action}: ${detail}`);
}

// Seed welcome notes on first run only.
if (firstRun && notes.state.items.length === 0) {
  notes.set("items", welcomeNotes());
  log("notes.seed", "first run, wrote welcome notes");
}

// Main → windows: a heartbeat no renderer has to write.
const timer = setInterval(() => clock.set(new Date().toISOString()), 1000);
app.on("will-quit", () => clearInterval(timer));

// Main observes what any window changes, and records it on the audit feed —
// SyncArray is single-writer by design, and the main process is that writer.
for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
  settings.watch(key, (value) => log("settings.set", `${key} = ${JSON.stringify(value)}`));
}

function createWindow(role: "board" | "preview"): void {
  const win = new BrowserWindow({
    width: role === "preview" ? 540 : 780,
    height: 640,
    title: role === "preview" ? "notes — preview" : "notes — board",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    // electron-vite dev server
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?role=${role}`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), { query: { role } });
  }
}

ipcMain.handle("demo:open-window", (_event, role: unknown) => {
  createWindow(role === "preview" ? "preview" : "board");
});

void app.whenReady().then(() => {
  createWindow("board");
  createWindow("preview");
});

app.on("window-all-closed", () => {
  app.quit();
});
