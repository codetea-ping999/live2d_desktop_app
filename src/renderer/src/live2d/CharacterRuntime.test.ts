import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '../../../../test/helpers/deferred'
import { createControlledLoader, MockStage, type MockModel } from '../../../../test/helpers/live2d'
import { bindWindowEvents, CharacterRuntime, layoutPosition } from './CharacterRuntime'

const viewport = { width: 400, height: 500 }

function setup() {
  const stage = new MockStage()
  const loads = createControlledLoader()
  const runtime = new CharacterRuntime<MockModel>({
    stage,
    loadModel: loads.loader,
    viewport: () => viewport,
    initialScale: 0.25,
    initialOpacity: 1
  })
  return { stage, loads, runtime }
}

describe('layoutPosition', () => {
  it('centres horizontally and stands on the bottom edge', () => {
    expect(layoutPosition({ width: 100, height: 200 }, { width: 400, height: 500 })).toEqual({
      x: 150,
      y: 300
    })
  })
})

describe('CharacterRuntime lifecycle (#13)', () => {
  it('commits a loaded model with the current scale, opacity and layout', async () => {
    const { stage, loads, runtime } = setup()
    const result = runtime.load('a')
    const model = loads.resolve('a')
    await expect(result).resolves.toEqual({ status: 'loaded', url: 'a' })
    expect(stage.children).toEqual([model])
    expect(model.scale).toBe(0.25)
    expect(model.opacity).toBe(1)
    expect(model.x).toBe((400 - 100) / 2)
    expect(model.y).toBe(500 - 200)
    expect(runtime.getStatus()).toMatchObject({ phase: 'ready', currentUrl: 'a' })
  })

  it('applies scale / opacity changed while the load was pending', async () => {
    const { loads, runtime } = setup()
    const result = runtime.load('a')
    runtime.setScale(0.5)
    runtime.setOpacity(0.4)
    const model = loads.resolve('a')
    await result
    expect(model.scale).toBe(0.5)
    expect(model.opacity).toBe(0.4)
    expect(model.y).toBe(500 - 400)
  })

  it('never commits a load that resolves after destroy (unmount during load)', async () => {
    const { stage, loads, runtime } = setup()
    const listener = vi.fn()
    runtime.subscribe(listener)
    const result = runtime.load('a')
    listener.mockClear()
    runtime.destroy()
    const model = loads.resolve('a')
    await expect(result).resolves.toEqual({ status: 'stale', url: 'a' })
    expect(stage.children).toEqual([])
    expect(stage.destroyed).toBe(true)
    expect(model.destroyed).toBe(true)
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps only the last request when switching A → B → C quickly', async () => {
    const { stage, loads, runtime } = setup()
    const a = runtime.load('a')
    const b = runtime.load('b')
    const c = runtime.load('c')
    // Resolve out of order: C first, then the obsolete ones.
    const mc = loads.resolve('c')
    await flushPromises()
    const ma = loads.resolve('a')
    const mb = loads.resolve('b')
    await expect(Promise.all([a, b, c])).resolves.toEqual([
      { status: 'stale', url: 'a' },
      { status: 'stale', url: 'b' },
      { status: 'loaded', url: 'c' }
    ])
    expect(stage.children).toEqual([mc])
    expect(ma.destroyed).toBe(true)
    expect(mb.destroyed).toBe(true)
    expect(mc.destroyed).toBe(false)
    expect(runtime.getStatus()).toMatchObject({ phase: 'ready', currentUrl: 'c' })
  })

  it('destroys the previous model when a new one is committed', async () => {
    const { stage, loads, runtime } = setup()
    const first = runtime.load('a')
    const ma = loads.resolve('a')
    await first
    const second = runtime.load('b')
    const mb = loads.resolve('b')
    await second
    expect(stage.children).toEqual([mb])
    expect(ma.destroyed).toBe(true)
  })

  it('keeps the healthy model on stage when the next load fails', async () => {
    const { stage, loads, runtime } = setup()
    const first = runtime.load('a')
    const ma = loads.resolve('a')
    await first
    const second = runtime.load('broken')
    loads.reject('broken', new Error('missing texture'))
    const result = await second
    expect(result).toMatchObject({ status: 'error', url: 'broken' })
    expect(stage.children).toEqual([ma])
    expect(ma.destroyed).toBe(false)
    expect(runtime.getStatus()).toMatchObject({
      phase: 'error',
      currentUrl: 'a',
      error: 'missing texture'
    })
  })

  it('ignores a failure of an obsolete request', async () => {
    const { loads, runtime } = setup()
    const a = runtime.load('a')
    const b = runtime.load('b')
    loads.reject('a')
    const mb = loads.resolve('b')
    await expect(a).resolves.toMatchObject({ status: 'stale' })
    await expect(b).resolves.toMatchObject({ status: 'loaded' })
    expect(mb.destroyed).toBe(false)
    expect(runtime.getStatus().phase).toBe('ready')
  })

  it('survives React StrictMode setup → cleanup → setup', async () => {
    const loads = createControlledLoader()
    const stage1 = new MockStage()
    const stage2 = new MockStage()
    const make = (stage: MockStage) =>
      new CharacterRuntime<MockModel>({ stage, loadModel: loads.loader, viewport: () => viewport })

    const rt1 = make(stage1)
    const p1 = rt1.load('a')
    rt1.destroy()
    const rt2 = make(stage2)
    const p2 = rt2.load('a')

    const m1 = loads.resolve('a')
    const m2 = loads.resolve('a')
    await Promise.all([p1, p2])

    expect(stage1.children).toEqual([])
    expect(m1.destroyed).toBe(true)
    expect(stage2.children).toEqual([m2])
    expect(m2.destroyed).toBe(false)
  })

  it('aborts the signal of a superseded request', async () => {
    const { loads, runtime } = setup()
    void runtime.load('a')
    const signalA = loads.loader.mock.calls[0][1]!
    void runtime.load('b')
    expect(signalA.aborted).toBe(true)
  })

  it('clear() removes the model and makes pending loads stale', async () => {
    const { stage, loads, runtime } = setup()
    const first = runtime.load('a')
    const ma = loads.resolve('a')
    await first
    const pending = runtime.load('b')
    runtime.clear()
    const mb = loads.resolve('b')
    await expect(pending).resolves.toMatchObject({ status: 'stale' })
    expect(stage.children).toEqual([])
    expect(ma.destroyed).toBe(true)
    expect(mb.destroyed).toBe(true)
    expect(runtime.getStatus().phase).toBe('idle')
  })

  it('delegates interaction to the current model and is a no-op without one', async () => {
    const { loads, runtime } = setup()
    expect(() => runtime.focus(1, 2)).not.toThrow()
    expect(runtime.containsPoint(1, 2)).toBe(false)
    const p = runtime.load('a')
    const model = loads.resolve('a')
    await p
    runtime.focus(10, 20)
    runtime.tap(5, 6)
    runtime.playMotion('Idle')
    runtime.playExpression('smile')
    expect(model.focus).toHaveBeenCalledWith(10, 20)
    expect(model.tap).toHaveBeenCalledWith(5, 6)
    expect(model.playMotion).toHaveBeenCalledWith('Idle')
    expect(model.playExpression).toHaveBeenCalledWith('smile')
    expect(runtime.containsPoint(200, 450)).toBe(true)
    expect(runtime.containsPoint(5, 5)).toBe(false)
  })
})

describe('bindWindowEvents', () => {
  it('adds resize / mousemove once and removes exactly those listeners', async () => {
    const { loads, runtime } = setup()
    const p = runtime.load('a')
    const model = loads.resolve('a')
    await p
    const target = new EventTarget()
    const add = vi.spyOn(target, 'addEventListener')
    const remove = vi.spyOn(target, 'removeEventListener')

    const unbind = bindWindowEvents(runtime, target)
    const move = Object.assign(new Event('mousemove'), { clientX: 7, clientY: 9 })
    target.dispatchEvent(move)
    expect(model.focus).toHaveBeenCalledWith(7, 9)

    unbind()
    model.focus.mockClear()
    target.dispatchEvent(move)
    expect(model.focus).not.toHaveBeenCalled()
    expect(add).toHaveBeenCalledTimes(2)
    expect(remove.mock.calls.map((c) => c[1])).toEqual(add.mock.calls.map((c) => c[1]))
  })
})
