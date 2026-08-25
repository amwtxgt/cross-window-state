import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProxyState, debounce, deepEqual } from '../../../src/core/utils'

afterEach(() => {
  vi.useRealTimers()
})

describe('debounce', () => {
  it('executes only the last call after the wait', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 300)
    d(1)
    d(2)
    d(3)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it('resets the timer on each call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 300)
    d(1)
    vi.advanceTimersByTime(200)
    d(2)
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
  })

  it('does not execute after cancel', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 300)
    d(1)
    d.cancel()
    vi.advanceTimersByTime(600)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush executes the pending invocation immediately', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 300)
    d(1)
    d(2)
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
    vi.advanceTimersByTime(600)
    expect(fn).toHaveBeenCalledTimes(1) // not re-fired after flush
  })

  it('flush without a pending invocation is a no-op', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 300)
    d.flush()
    d.cancel()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('deepEqual', () => {
  it('compares primitives', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
    expect(deepEqual(NaN, NaN)).toBe(true)
    expect(deepEqual(1, '1')).toBe(false)
  })

  it('compares objects including nested', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true)
    expect(deepEqual({ a: { b: [1, 2] } }, { a: { b: [2, 1] } })).toBe(false)
  })

  it('is key-order independent', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it('distinguishes undefined value from missing key', () => {
    expect(deepEqual({ a: undefined }, {})).toBe(false)
    expect(deepEqual({}, { a: undefined })).toBe(false)
  })

  it('compares arrays order-sensitively', () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
  })

  it('returns false on circular references without infinite loop', () => {
    const a: Record<string, unknown> = { name: 'x' }
    a.self = a
    const b: Record<string, unknown> = { name: 'x' }
    b.self = b
    expect(deepEqual(a, b)).toBe(false)
    // identical reference short-circuits to true
    expect(deepEqual(a, a)).toBe(true)
  })

  it('returns false for mismatched shapes', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(deepEqual([1], { 0: 1 })).toBe(false)
    expect(deepEqual({ a: 1 }, null)).toBe(false)
  })
})

describe('createProxyState', () => {
  it('reads through to the underlying data', () => {
    const data = { a: 1, b: 'x' }
    const p = createProxyState(data, () => {})
    expect(p.a).toBe(1)
    expect(p.b).toBe('x')
    expect(p['missing' as keyof typeof p]).toBeUndefined()
  })

  it('set updates data and fires the write callback', () => {
    const data = { a: 1 }
    const onSet = vi.fn()
    const p = createProxyState(data, onSet)
    p.a = 10
    expect(data.a).toBe(10)
    expect(onSet).toHaveBeenCalledWith('a', 10)
  })

  it('delete removes the key and fires the delete callback', () => {
    const data = { a: 1, b: 2 }
    const onSet = vi.fn()
    const onDelete = vi.fn()
    const p = createProxyState(data, onSet, onDelete)
    delete p.a
    expect('a' in data).toBe(false)
    expect(data.b).toBe(2)
    expect(onDelete).toHaveBeenCalledWith('a')
    expect(onSet).not.toHaveBeenCalled()
  })

  it('delete falls back to onSet(key, undefined) without onDelete', () => {
    const data = { a: 1 }
    const onSet = vi.fn()
    const p = createProxyState(data, onSet)
    delete p.a
    expect('a' in data).toBe(false)
    expect(onSet).toHaveBeenCalledWith('a', undefined)
  })

  it('supports Object.keys, in operator and spread', () => {
    const data = { a: 1, b: 2, c: 3 }
    const p = createProxyState(data, () => {})
    expect(Object.keys(p)).toEqual(['a', 'b', 'c'])
    expect('a' in p).toBe(true)
    expect('zz' in p).toBe(false)
    expect({ ...p }).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('new keys added via proxy propagate', () => {
    const data: Record<string, unknown> = { a: 1 }
    const onSet = vi.fn()
    const p = createProxyState(data, onSet)
    ;(p as Record<string, unknown>).newKey = 'v'
    expect(data.newKey).toBe('v')
    expect(onSet).toHaveBeenCalledWith('newKey', 'v')
  })

  it('write callback error propagates while data stays updated', () => {
    const data = { a: 1 }
    const p = createProxyState(data, () => {
      throw new Error('reject')
    })
    expect(() => {
      p.a = 5
    }).toThrow('reject')
    expect(data.a).toBe(5)
  })
})
