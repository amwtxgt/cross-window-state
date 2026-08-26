export type Role = "board" | "preview";

/** Window role arrives via `?role=preview` (loadFile query or dev-server URL). */
export const role: Role =
  new URLSearchParams(window.location.search).get("role") === "preview" ? "preview" : "board";

/** Electron windows carry the preload bridge; plain browser tabs do not. */
export const isElectron: boolean =
  (window as unknown as { __crossWindowState__?: unknown }).__crossWindowState__ !== undefined;

/** Demo-only preload surface (Electron) for opening extra windows. */
export const demoBridge = (window as unknown as { __notes__?: { openWindow(role: string): void } })
  .__notes__;

/**
 * Stable id per window/tab for its lifetime. sessionStorage is per
 * top-level browsing context: a reload keeps its id, a newly opened tab gets
 * a fresh one. (A browser "duplicate tab" COPIES sessionStorage, so the
 * duplicate briefly shares the id — presence dedupes on the next heartbeat.)
 */
export const windowId: string = (() => {
  const KEY = "notes-example-window-id";
  const existing = sessionStorage.getItem(KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(KEY, id);
  return id;
})();
