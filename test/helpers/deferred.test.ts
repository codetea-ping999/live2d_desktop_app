import { describe, expect, it } from 'vitest'
import { deferred, flushPromises } from './deferred'

describe('deferred helper', () => {
  it('settles only when the test says so', async () => {
    const d = deferred<number>()
    let value: number | undefined
    d.promise.then((v) => (value = v))
    await flushPromises()
    expect(value).toBeUndefined()
    d.resolve(42)
    await flushPromises()
    expect(value).toBe(42)
  })
})
