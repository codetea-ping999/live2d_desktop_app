import { describe, expect, it } from 'vitest'
import { PointerGesture } from './pointerGesture'

const p = (x: number, y: number) => ({
  clientX: x,
  clientY: y,
  screenX: x + 1000,
  screenY: y + 500
})

describe('PointerGesture (#3)', () => {
  it('a short click is a tap, not a drag', () => {
    const g = new PointerGesture(4)
    g.down(p(10, 10))
    expect(g.move(p(12, 11))).toBeNull()
    expect(g.up(p(12, 11))).toEqual({ type: 'tap', at: p(10, 10) })
  })

  it('moving past the threshold starts a drag and never taps', () => {
    const g = new PointerGesture(4)
    g.down(p(10, 10))
    expect(g.move(p(20, 10))).toEqual({ type: 'drag-start', origin: p(10, 10), current: p(20, 10) })
    expect(g.move(p(30, 15))).toEqual({ type: 'drag-move', current: p(30, 15) })
    expect(g.up(p(31, 15))).toEqual({ type: 'drag-end', current: p(31, 15) })
  })

  it('ignores moves without a press and resets after cancel', () => {
    const g = new PointerGesture(4)
    expect(g.move(p(50, 50))).toBeNull()
    g.down(p(0, 0))
    g.move(p(10, 0))
    expect(g.cancel(p(10, 0))).toEqual({ type: 'drag-end', current: p(10, 0) })
    expect(g.active).toBe(false)
    expect(g.up(p(10, 0))).toBeNull()
  })
})
