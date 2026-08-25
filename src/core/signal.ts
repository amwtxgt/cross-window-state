/**
 * Minimal reactive primitive shared by every entry of cross-window-state.
 *
 * The whole library only needs shallow "value changed" notifications, so a
 * ~50-line signal replaces @vue/reactivity and keeps `core` dependency-free.
 */

export interface Signal<T> {
  /** Current value. */
  readonly value: T;
  /** Set a new value and notify subscribers (unless identical, see options). */
  set(next: T): void;
  /**
   * Subscribe to value changes. Returns an unsubscribe function.
   * Callbacks are isolated: a throwing listener is reported via
   * `console.error` and does not affect other listeners or later sets.
   */
  subscribe(cb: (newVal: T, oldVal: T | undefined) => void): () => void;
}

export interface SignalOptions {
  /**
   * `identity` (default): skip notification when `Object.is(old, next)`.
   * `always`: notify on every set, even for identical references — use when
   * callers mutate objects in place and re-assign the same reference.
   */
  equality?: "identity" | "always";
}

export function createSignal<T>(initial: T, options?: SignalOptions): Signal<T> {
  const equality = options?.equality ?? "identity";
  let value = initial;
  const listeners = new Set<(newVal: T, oldVal: T | undefined) => void>();

  let notifying = false;
  let pending: T | undefined;
  let hasPending = false;

  function notify(next: T, old: T | undefined): void {
    notifying = true;
    try {
      for (const cb of [...listeners]) {
        try {
          cb(next, old);
        } catch (err) {
          console.error("[cws:signal] listener error:", err);
        }
      }
    } finally {
      notifying = false;
      // Re-entrant sets during notification are queued, not recursed, so a
      // listener that writes back cannot overflow the stack or double-fire.
      if (hasPending) {
        hasPending = false;
        const queued = pending as T;
        doSet(queued);
      }
    }
  }

  function doSet(next: T): void {
    const old = value;
    if (equality === "identity" && Object.is(old, next)) return;
    value = next;
    notify(next, old);
  }

  return {
    get value() {
      return value;
    },
    set(next) {
      if (notifying) {
        // Keep only the latest re-entrant value; intermediate ones collapse.
        pending = next;
        hasPending = true;
        if (equality === "identity" && Object.is(value, next)) {
          hasPending = false;
        }
        return;
      }
      doSet(next);
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
