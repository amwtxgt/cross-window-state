import { contextBridge, ipcRenderer } from "electron";
import "cross-window-state/preload";

// Demo-only surface: let any window ask the main process for another window.
contextBridge.exposeInMainWorld("__notes__", {
  openWindow(role: string): void {
    void ipcRenderer.invoke("demo:open-window", role);
  },
});
