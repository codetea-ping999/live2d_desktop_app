import { DEFAULT_WINDOW_SIZE, type WindowBounds } from './settings'

/**
 * Pure multi-monitor placement logic (#4, #8).
 *
 * All values are Electron DIP (device-independent pixels), which is what
 * `screen.getAllDisplays()[].workArea` and `BrowserWindow.getBounds()` use, so
 * Retina / mixed scale factors need no conversion here.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayLike {
  id: number
  workArea: Rect
}

/** A window must show at least this much on some display to count as visible. */
export const MIN_VISIBLE = { width: 64, height: 64 } as const

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function intersectionSize(a: Rect, b: Rect): { width: number; height: number } {
  return {
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  }
}

export function isFullyInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/** Move (and if needed shrink) `bounds` the minimum amount to fit `area`. */
export function clampInto(bounds: Rect, area: Rect): WindowBounds {
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - height)
  return { x, y, width, height }
}

/** Default spot: bottom-right corner of the work area, like a desktop mascot. */
export function defaultBounds(area: Rect, margin = 16): WindowBounds {
  const width = Math.min(DEFAULT_WINDOW_SIZE.width, area.width)
  const height = Math.min(DEFAULT_WINDOW_SIZE.height, area.height)
  return {
    x: Math.max(area.x, area.x + area.width - width - margin),
    y: Math.max(area.y, area.y + area.height - height),
    width,
    height
  }
}

/**
 * Decide where the window should appear.
 *
 * - fully on one display → unchanged (never move a valid position)
 * - partly off-screen but meaningfully visible → clamp into the display it
 *   overlaps most, moving it as little as possible
 * - not (meaningfully) visible anywhere, or no saved bounds → default spot
 *   on the primary display
 */
export function resolveWindowBounds(
  saved: WindowBounds | null,
  displays: DisplayLike[],
  primary: DisplayLike
): WindowBounds {
  if (!saved) return defaultBounds(primary.workArea)

  let best: DisplayLike | null = null
  let bestArea = 0
  for (const display of displays) {
    if (isFullyInside(saved, display.workArea)) return { ...saved }
    const area = intersectionArea(saved, display.workArea)
    if (area > bestArea) {
      best = display
      bestArea = area
    }
  }

  if (best) {
    const visible = intersectionSize(saved, best.workArea)
    if (visible.width >= MIN_VISIBLE.width && visible.height >= MIN_VISIBLE.height) {
      return clampInto(saved, best.workArea)
    }
  }
  return defaultBounds(primary.workArea)
}

export function sameBounds(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
