import { watch } from "vue";
import type { ShallowRef } from "vue";
import { useStorageState } from "cross-window-state/vue";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, STORAGE } from "../../shared/notes";
import type { Settings } from "../../shared/notes";

/**
 * Persisted settings (Electron: JSON file; web: localStorage). Editable from
 * any window — every other window applies the change live.
 */
export function useSettings() {
  const { state, set } = useStorageState<Settings>(
    STORAGE.settings,
    DEFAULT_SETTINGS,
    SETTINGS_VERSION,
  );
  const settings = state as ShallowRef<Settings>;
  return { settings, setSetting: set };
}

let applying = false;

/** Apply settings to <html> once per window, re-applying on every change. */
export function useApplySettings(): void {
  if (applying) return;
  applying = true;
  const { settings } = useSettings();
  watch(
    () =>
      [
        settings.value.theme,
        settings.value.fontScale,
        settings.value.compact,
        settings.value.locale,
      ] as const,
    ([theme, fontScale, compact, locale]) => {
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.dataset.fontScale = fontScale;
      root.classList.toggle("compact", compact);
      root.lang = locale;
    },
    { immediate: true },
  );
}
