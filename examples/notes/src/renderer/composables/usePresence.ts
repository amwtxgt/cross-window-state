import { onMounted, shallowRef } from "vue";
import type { ShallowRef } from "vue";
import { createRuntimeState } from "cross-window-state/renderer";
import { RUNTIME } from "../../shared/notes";
import type { PresenceEntry } from "../../shared/notes";
import { role, windowId } from "../env";

/**
 * Presence: which windows/tabs are alive right now. Purely ephemeral, so it
 * is a runtime state. Every window is a writer — and web mode has no central
 * state holder — so each window re-announces itself on a heartbeat and prunes
 * entries whose heartbeat went quiet. Every announce is a read-modify-write
 * on the LATEST value (SyncArray would clobber here; it is for single-writer
 * feeds like the audit log).
 */
const HEARTBEAT_MS = 2000;
const STALE_AFTER_MS = 7000;

const state = createRuntimeState<PresenceEntry[]>(RUNTIME.presence, []);

const presence: ShallowRef<PresenceEntry[]> = shallowRef([...state.state]);

state.watch((value) => {
  presence.value = [...(value ?? [])];
});

function announce(): void {
  const now = Date.now();
  const fresh = state.state.filter(
    (e) => e.id !== windowId && now - Date.parse(e.lastSeen) < STALE_AFTER_MS,
  );
  state.set([...fresh, { id: windowId, role, lastSeen: new Date(now).toISOString() }]);
}

function leave(): void {
  state.set(state.state.filter((e) => e.id !== windowId));
}

let timer: ReturnType<typeof setInterval> | undefined;

export function usePresence() {
  onMounted(() => {
    if (timer) return;
    announce();
    timer = setInterval(announce, HEARTBEAT_MS);
    window.addEventListener("beforeunload", leave);
  });
  return { presence };
}
