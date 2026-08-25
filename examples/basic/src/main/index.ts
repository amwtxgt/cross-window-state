import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { createRuntimeState, createStorageState } from "cross-window-state/main";

// Allow e2e runs to pin a stable userData dir (restart-persistence tests)
if (process.env.CWS_USER_DATA) {
  app.setPath("userData", process.env.CWS_USER_DATA);
}

// Main process owns the same states the renderers use — zero-difference DX.
const counter = createRuntimeState("counter", 0);
const settings = createStorageState("settings", { theme: "light", notifications: true }, 1);

counter.watch((v) => console.log("[main] counter =", v));
settings.watch("theme", (v) => console.log("[main] settings.theme =", v));

function createWindow(): void {
  const win = new BrowserWindow({
    width: 460,
    height: 420,
    title: "cross-window-state demo",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // E2E / production build: load the bundled file; dev falls back to dev server
  win.loadFile(join(__dirname, "../renderer/index.html")).catch(() => {
    win.loadURL("http://localhost:5173");
  });
}

ipcMain.handle("demo:open-window", () => {
  createWindow();
});

app.whenReady().then(() => {
  createWindow();
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
