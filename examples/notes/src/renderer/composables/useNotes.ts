import { computed } from "vue";
import type { ShallowRef } from "vue";
import { useStorageState } from "cross-window-state/vue";
import { DEFAULT_NOTES, STORAGE, welcomeNotes } from "../../shared/notes";
import type { Note, NotesData } from "../../shared/notes";
import { isElectron } from "../env";

const SEED_FLAG = "notes-example-seeded";
let seedChecked = false;

/**
 * The notes themselves are a storage state: they sync across windows like a
 * runtime state AND survive a restart. `items` is one key holding the array;
 * every mutation commits a fresh array via `set("items", next)`.
 */
export function useNotes() {
  const { state, set } = useStorageState<NotesData>(STORAGE.notes, DEFAULT_NOTES, 1);
  const notes = state as ShallowRef<NotesData>;

  // Web mode has no main process — the first tab seeds the welcome notes.
  // (Electron mode seeds in main; two brand-new tabs racing here is harmless.)
  if (!isElectron && !seedChecked) {
    seedChecked = true;
    if (!localStorage.getItem(SEED_FLAG)) {
      localStorage.setItem(SEED_FLAG, "1");
      if (notes.value.items.length === 0) set("items", welcomeNotes());
    }
  }

  const items = computed(() => notes.value.items);

  function commit(next: Note[]): void {
    set("items", next);
  }

  function addNote(): string {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "New note",
      body: "",
      color: "yellow",
      updatedAt: new Date().toISOString(),
    };
    commit([...notes.value.items, note]);
    return note.id;
  }

  function updateNote(id: string, patch: Partial<Omit<Note, "id">>): void {
    commit(
      notes.value.items.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
      ),
    );
  }

  function removeNote(id: string): void {
    commit(notes.value.items.filter((n) => n.id !== id));
  }

  return { items, addNote, updateNote, removeNote };
}
