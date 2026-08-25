/**
 * Storage IPC wiring: importing this module (via `cross-window-state/main`)
 * registers the storage handlers once the app is ready.
 *
 * - `cws:storage:get` (sendSync): creates the store on first call using the
 *   renderer-supplied defaults/version/options, then returns the merged
 *   state. Configuration errors surface as `null` so renderers can fall
 *   back to their defaults.
 * - `cws:storage:set` (send, fire-and-forget): applies a patch. A set for an
 *   unknown store logs a warning instead of silently dropping the write
 *   (get must come first — that is how the store learns its config).
 */
import { app, ipcMain } from "electron";
import { channel } from "../core/protocol";
import type { StorageGetPayload } from "../core/protocol";
import { StorageStore } from "./storage-store";

export function setupStorageIpc(): void {
  ipcMain.on(channel.storageGet, (event, name: unknown, payload: unknown) => {
    try {
      if (typeof name !== "string" || name.length === 0 || !isStorageGetPayload(payload)) {
        console.error(
          `[cws] storage get rejected: malformed name/payload (${JSON.stringify(name)})`,
        );
        event.returnValue = null;
        return;
      }
      const store = new StorageStore(name, payload.defaults, payload.version, payload.options);
      event.returnValue = store.getByRenderer(event.sender.id);
    } catch (err) {
      console.error(`[cws] storage get failed for "${String(name)}":`, err);
      event.returnValue = null;
    }
  });
  ipcMain.on(channel.storageSet, (_event, name: unknown, patch: unknown) => {
    if (typeof name !== "string" || typeof patch !== "object" || patch === null) {
      console.warn("[cws] storage set rejected: malformed name or patch");
      return;
    }
    const store = StorageStore.instances.get(name);
    if (!store) {
      console.warn(
        `[cws] storage set for unknown store "${name}" ignored — get() must create it first.`,
      );
      return;
    }
    store.setByRenderer(patch as Record<string, unknown>);
  });
}

function isStorageGetPayload(payload: unknown): payload is StorageGetPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.version === "number" &&
    typeof p.defaults === "object" &&
    p.defaults !== null &&
    !Array.isArray(p.defaults)
  );
}

void app.whenReady().then(setupStorageIpc);

// App-quit flush: changes inside the last debounce window (300ms) must not
// be lost — nobody calls destroy() on quit, so do it for every live store.
app.on("will-quit", () => {
  for (const store of StorageStore.instances.values()) {
    store.flushSync();
  }
});
