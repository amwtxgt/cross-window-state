import { useRuntimeState } from "cross-window-state/vue";
import { RUNTIME } from "../../shared/notes";
import { role } from "../env";

/**
 * The selected note is a runtime state: shared live, never written to disk —
 * exactly what UI selection wants. The preview window takes a read-only
 * handle: it renders the selection but `set()` is rejected there.
 */
export function useSelectedNote() {
  const { state: selectedId, set } = useRuntimeState<string>(RUNTIME.selected, "", {
    readonly: role === "preview",
  });
  return { selectedId, select: set };
}
