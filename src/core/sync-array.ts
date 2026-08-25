/**
 * SyncArray lives in core because main and renderer share the exact same
 * implementation — it only depends on the `.set` / `.state` surface of a
 * runtime state, so it works on both sides of the IPC boundary.
 *
 * Every mutating method produces a fresh array and commits it through
 * `state.set()`, which is what keeps every window in sync; read methods are
 * plain local reads. `batch` collapses many mutations into one commit so
 * intermediate shapes never hit the wire.
 */

export interface RuntimeStateLike<T> {
  readonly state: T
  set(value: T): void
}

export class SyncArray<T> {
  private data: T[]

  /**
   * Adopts a non-empty remote value when one exists (late joiner keeps the
   * live state); otherwise seeds the state with `initial`.
   */
  constructor(state: RuntimeStateLike<T[]>, initial: T[] = []) {
    this.state = state
    const remote = state.state
    if (remote.length > 0) {
      this.data = [...remote]
    } else {
      this.data = [...initial]
      state.set(this.data)
    }
  }

  private state: RuntimeStateLike<T[]>

  private commit(next: T[]): void {
    this.data = next
    this.state.set(next)
  }

  /** Snapshot of the data. Mutating the returned array has no effect. */
  get all(): T[] {
    return [...this.data]
  }

  get length(): number {
    return this.data.length
  }

  push(...items: T[]): number {
    this.commit([...this.data, ...items])
    return this.data.length
  }

  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const next = [...this.data]
    const removed =
      deleteCount === undefined ? next.splice(start) : next.splice(start, deleteCount, ...items)
    this.commit(next)
    return removed
  }

  /** Replace the whole dataset. */
  replace(newData: T[]): void {
    this.commit([...newData])
  }

  /** Remove every item matching the predicate. */
  remove(predicate: (item: T, index: number) => boolean): void {
    this.commit(this.data.filter((item, index) => !predicate(item, index)))
  }

  /** Apply many mutations on a draft, then commit exactly once. */
  batch(mutator: (draft: T[]) => void): void {
    const draft = [...this.data]
    mutator(draft)
    this.commit(draft)
  }

  at(index: number): T | undefined {
    const i = index < 0 ? this.data.length + index : index
    return this.data[i]
  }

  find(predicate: (item: T, index: number) => boolean): T | undefined {
    return this.data.find((item, index) => predicate(item, index))
  }

  findIndex(predicate: (item: T, index: number) => boolean): number {
    return this.data.findIndex((item, index) => predicate(item, index))
  }

  filter(predicate: (item: T, index: number) => boolean): T[] {
    return this.data.filter((item, index) => predicate(item, index))
  }

  some(predicate: (item: T, index: number) => boolean): boolean {
    return this.data.some((item, index) => predicate(item, index))
  }

  includes(item: T): boolean {
    return this.data.includes(item)
  }

  forEach(fn: (item: T, index: number) => void): void {
    this.data.forEach(fn)
  }

  map<U>(fn: (item: T, index: number) => U): U[] {
    return this.data.map(fn)
  }
}
