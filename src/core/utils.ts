/**
 * Dependency-free utilities shared by every entry: debounce (persistence),
 * deepEqual (defaults validation) and createProxyState (writable `.state`).
 */

export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void
  /** Discard the pending invocation, if any. */
  cancel(): void
}

/** Trailing-edge debounce. Leading calls are intentionally not supported. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const wrapped = ((...args: Args) => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, wait)
  }) as DebouncedFunction<Args>
  wrapped.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  return wrapped
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  // Class instances (Date, Map, ...) are compared by reference only.
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null
}

/**
 * Structural equality for JSON-shaped data (what storage state holds).
 * Key order is ignored; arrays are order-sensitive; `undefined` values are
 * distinct from missing keys. Circular structures return false instead of
 * looping forever — good enough for the defaults-validation use case.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return deepEqualWithCycleCheck(a, b, new WeakSet<object>())
}

function deepEqualWithCycleCheck(a: unknown, b: unknown, path: WeakSet<object>): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null) return false
  if (typeof b !== 'object' || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (path.has(a)) return false
    path.add(a)
    const ok =
      a.length === b.length && a.every((item, i) => deepEqualWithCycleCheck(item, b[i], path))
    path.delete(a)
    return ok
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false
  if (path.has(a)) return false
  path.add(a)
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  const ok =
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        key in b && // distinguishes `{a: undefined}` from `{}`
        deepEqualWithCycleCheck(a[key], b[key], path),
    )
  path.delete(a)
  return ok
}

/**
 * Wrap `data` in a Proxy that routes writes through callbacks while reads,
 * iteration and spread behave like the plain object. This is the machinery
 * behind the writable `.state` on both main and renderer storage states —
 * `state.key = value` transparently goes through the sync pipeline.
 *
 * Write semantics: `data` is updated first, then the callback fires; a
 * throwing callback propagates to the assignment expression while the data
 * change itself is kept (no rollback) — the caller decides how to react.
 *
 * `delete proxy.key` calls `onDelete(key)` when provided, otherwise
 * `onSet(key, undefined)` so deletes keep flowing through the same pipeline.
 */
export function createProxyState<T extends Record<string, unknown>>(
  data: T,
  onSet: (key: string, value: unknown) => void,
  onDelete?: (key: string) => void,
): T {
  return new Proxy(data, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver)
    },
    set(target, prop, value) {
      const ok = Reflect.set(target, prop, value)
      if (ok && typeof prop === 'string') onSet(prop, value)
      return ok
    },
    deleteProperty(target, prop) {
      const ok = Reflect.deleteProperty(target, prop)
      if (ok && typeof prop === 'string') {
        if (onDelete) onDelete(prop)
        else onSet(prop, undefined)
      }
      return ok
    },
    has(target, prop) {
      return Reflect.has(target, prop)
    },
    ownKeys(target) {
      return Reflect.ownKeys(target)
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  })
}
