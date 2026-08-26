import { useRuntimeState } from "cross-window-state/vue";
import { RUNTIME } from "../../shared/notes";

/**
 * Wall clock ticked by the Electron main process once per second — an example
 * of main → windows writes. In web mode nobody writes it, so it stays "".
 */
export function useClock() {
  const { state: clock } = useRuntimeState<string>(RUNTIME.clock, "");
  return { clock };
}
