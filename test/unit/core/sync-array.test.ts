import { describe, expect, it, vi } from 'vitest'
import { SyncArray } from '../../../src/core/sync-array'

function makeState<T>(initial: T[] = []) {
  let current = initial
  const set = vi.fn((next: T[]) => {
    current = next
  })
  return {
    set,
    get state(): T[] {
      return current
    },
  }
}

describe('SyncArray', () => {
  it('mutating methods commit via state.set', () => {
    const state = makeState<number>()
    const arr = new SyncArray(state, [1])
    expect(state.set).toHaveBeenCalledTimes(1)

    arr.push(2, 3)
    expect(state.set).toHaveBeenCalledTimes(2)
    expect(arr.all).toEqual([1, 2, 3])

    arr.splice(1, 1)
    expect(arr.all).toEqual([1, 3])

    arr.replace([7, 8])
    expect(arr.all).toEqual([7, 8])

    arr.remove((x) => x === 7)
    expect(arr.all).toEqual([8])
    expect(state.set).toHaveBeenCalledTimes(5)
  })

  it('batch performs many mutations with a single set', () => {
    const state = makeState<string>()
    const arr = new SyncArray(state, ['a'])
    state.set.mockClear()

    arr.batch((draft) => {
      draft.push('b')
      draft.push('c')
      draft.splice(0, 1)
    })

    expect(state.set).toHaveBeenCalledTimes(1)
    expect(arr.all).toEqual(['b', 'c'])
  })

  it('read methods never call set', () => {
    const state = makeState<number>([1, 2, 3])
    const arr = new SyncArray(state)
    state.set.mockClear()

    expect(arr.length).toBe(3)
    expect(arr.at(1)).toBe(2)
    expect(arr.find((x) => x > 1)).toBe(2)
    expect(arr.findIndex((x) => x === 3)).toBe(2)
    expect(arr.filter((x) => x > 1)).toEqual([2, 3])
    expect(arr.some((x) => x === 1)).toBe(true)
    expect(arr.includes(2)).toBe(true)
    expect(arr.map((x) => x * 2)).toEqual([2, 4, 6])
    arr.forEach(() => {})
    expect(arr.at(-1)).toBe(3)

    expect(state.set).not.toHaveBeenCalled()
  })

  it('adopts a non-empty remote value instead of overwriting it', () => {
    const state = makeState<number>([9, 9])
    const arr = new SyncArray(state, [1, 2])
    expect(arr.all).toEqual([9, 9])
  })

  it('all returns a defensive copy so callers cannot mutate internals', () => {
    const state = makeState<number>()
    const arr = new SyncArray(state, [1, 2])
    arr.all.push(3)
    expect(arr.all).toEqual([1, 2])
  })

  it('at with out-of-range index returns undefined', () => {
    const state = makeState<number>([1])
    const arr = new SyncArray(state)
    expect(arr.at(5)).toBeUndefined()
    expect(arr.at(-5)).toBeUndefined()
  })
})
