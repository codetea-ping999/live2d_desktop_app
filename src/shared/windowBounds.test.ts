import { describe, expect, it } from 'vitest'
import { clampInto, defaultBounds, resolveWindowBounds, type DisplayLike } from './windowBounds'

const laptop: DisplayLike = { id: 1, workArea: { x: 0, y: 25, width: 1440, height: 875 } }
// External monitor to the right of the laptop.
const external: DisplayLike = { id: 2, workArea: { x: 1440, y: 0, width: 2560, height: 1440 } }
// External monitor to the left with negative coordinates (Windows / macOS arrangement).
const leftMonitor: DisplayLike = { id: 3, workArea: { x: -1920, y: 0, width: 1920, height: 1040 } }

const win = (x: number, y: number, width = 400, height = 500) => ({ x, y, width, height })

describe('resolveWindowBounds (#4, #8)', () => {
  it('uses the default spot on the primary display when nothing is saved', () => {
    expect(resolveWindowBounds(null, [laptop], laptop)).toEqual(defaultBounds(laptop.workArea))
  })

  it('does not move a window that is fully visible', () => {
    expect(resolveWindowBounds(win(100, 100), [laptop, external], laptop)).toEqual(win(100, 100))
    expect(resolveWindowBounds(win(2000, 300), [laptop, external], laptop)).toEqual(win(2000, 300))
    expect(resolveWindowBounds(win(-1500, 200), [leftMonitor, laptop], laptop)).toEqual(
      win(-1500, 200)
    )
  })

  it('clamps minimally when partly off-screen', () => {
    // 100px hanging off the right edge of the laptop (single display).
    expect(resolveWindowBounds(win(1140, 100), [laptop], laptop)).toEqual(win(1040, 100))
    // Above the menu bar.
    expect(resolveWindowBounds(win(100, 0), [laptop], laptop)).toEqual(win(100, 25))
  })

  it('1 display → 2 displays → 1 display: a window left on the removed monitor comes back', () => {
    const onExternal = win(3000, 800)
    // Two displays: stays where it is.
    expect(resolveWindowBounds(onExternal, [laptop, external], laptop)).toEqual(onExternal)
    // External unplugged: not visible anywhere → default spot on the laptop.
    const back = resolveWindowBounds(onExternal, [laptop], laptop)
    expect(back).toEqual(defaultBounds(laptop.workArea))
  })

  it('treats a sliver of overlap as invisible', () => {
    // Only 10px visible on the laptop's right edge.
    expect(resolveWindowBounds(win(1430, 100), [laptop], laptop)).toEqual(
      defaultBounds(laptop.workArea)
    )
  })

  it('shrinks a window larger than the work area', () => {
    expect(clampInto(win(0, 0, 3000, 2000), laptop.workArea)).toEqual(laptop.workArea)
  })

  it('places the default window inside small displays', () => {
    const tiny: DisplayLike = { id: 9, workArea: { x: 0, y: 0, width: 300, height: 300 } }
    const b = resolveWindowBounds(null, [tiny], tiny)
    expect(b.width).toBeLessThanOrEqual(300)
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.y).toBeGreaterThanOrEqual(0)
  })
})
