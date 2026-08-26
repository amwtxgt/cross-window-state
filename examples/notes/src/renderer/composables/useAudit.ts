import { shallowRef } from "vue";
import type { ShallowRef } from "vue";
import { createRuntimeState } from "cross-window-state/renderer";
import { RUNTIME } from "../../shared/notes";
import type { AuditEntry } from "../../shared/notes";

/**
 * Read-only view of the audit feed. The writer is the Electron main process
 * via a SyncArray (single-writer by design); a window that opens late adopts
 * the current feed automatically. Stays empty in web mode.
 */
const state = createRuntimeState<AuditEntry[]>(RUNTIME.audit, []);

const auditEntries: ShallowRef<AuditEntry[]> = shallowRef([...(state.state ?? [])]);

state.watch((value) => {
  auditEntries.value = [...(value ?? [])];
});

export function useAudit() {
  return { auditEntries };
}
