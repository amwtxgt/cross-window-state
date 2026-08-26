/**
 * Shared schema: imported by the Electron main process AND the renderer, so
 * state names, defaults and versions can never drift apart.
 *
 * (`type` aliases, not interfaces — the library's `Record<string, unknown>`
 * constraint needs the implicit index signature interfaces don't get.)
 */

export type NoteColor = "yellow" | "pink" | "blue" | "green";

export type Note = {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  updatedAt: string;
};

export type NotesData = {
  items: Note[];
};

/**
 * App settings. Version history: v1 = { theme, fontScale }, v2 added
 * `compact`, v3 added `locale` — older files on disk migrate automatically on
 * next launch (try `node scripts/seed-v1-settings.mjs`).
 */
export const SETTINGS_VERSION = 3;

export type Locale = "en" | "zh-CN";

export type Settings = {
  theme: "light" | "dark";
  fontScale: "small" | "medium" | "large";
  compact: boolean;
  locale: Locale;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  fontScale: "medium",
  compact: false,
  locale: "en",
};

export const DEFAULT_NOTES: NotesData = { items: [] };

/** An open window/tab announcing itself on the presence state. */
export type PresenceEntry = {
  id: string;
  role: "board" | "preview";
  /** Refreshed by the owner's heartbeat; entries gone quiet are pruned. */
  lastSeen: string;
};

/** One line in the main-process audit feed. */
export type AuditEntry = {
  at: string;
  action: string;
  detail: string;
};

/** Storage state names — must match /^[a-zA-Z0-9_-]+$/ (also the file name). */
export const STORAGE = {
  notes: "notes",
  settings: "notes-settings",
} as const;

/** Runtime state names (memory only, never written to disk). */
export const RUNTIME = {
  /** Id of the note currently selected on any board. */
  selected: "notes-selected",
  /** Which windows/tabs are alive right now. */
  presence: "notes-presence",
  /** Settings-change feed, written by the Electron main process only. */
  audit: "notes-audit",
  /** Wall clock ticked by the main process once per second. */
  clock: "notes-clock",
} as const;

/** Two starter notes for a fresh install (main process / first web tab). */
export function welcomeNotes(): Note[] {
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      title: "Welcome to sticky notes",
      body: "Edit me in one window — every other window updates live. Notes are persisted and survive a restart.",
      color: "yellow",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: "Try the preview window",
      body: "Click a note on the board and watch the preview window follow your selection via a runtime state.",
      color: "blue",
      updatedAt: now,
    },
  ];
}
