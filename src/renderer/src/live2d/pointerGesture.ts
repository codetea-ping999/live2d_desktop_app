/**
 * Tells a click/tap on the character apart from a window drag (#3).
 * Pure state machine so the thresholds are unit-testable.
 */

export const DRAG_THRESHOLD_PX = 4

export interface PointerPoint {
  clientX: number
  clientY: number
  screenX: number
  screenY: number
}

export type GestureEvent =
  | { type: 'drag-start'; origin: PointerPoint; current: PointerPoint }
  | { type: 'drag-move'; current: PointerPoint }
  | { type: 'drag-end'; current: PointerPoint }
  | { type: 'tap'; at: PointerPoint }

export class PointerGesture {
  private origin: PointerPoint | null = null
  private dragging = false

  constructor(private readonly threshold = DRAG_THRESHOLD_PX) {}

  get active(): boolean {
    return this.origin !== null
  }

  get isDragging(): boolean {
    return this.dragging
  }

  down(point: PointerPoint): void {
    this.origin = point
    this.dragging = false
  }

  move(point: PointerPoint): GestureEvent | null {
    const origin = this.origin
    if (!origin) return null
    if (this.dragging) return { type: 'drag-move', current: point }
    const dx = point.screenX - origin.screenX
    const dy = point.screenY - origin.screenY
    if (Math.hypot(dx, dy) < this.threshold) return null
    this.dragging = true
    return { type: 'drag-start', origin, current: point }
  }

  up(point: PointerPoint): GestureEvent | null {
    const origin = this.origin
    const wasDragging = this.dragging
    this.origin = null
    this.dragging = false
    if (!origin) return null
    return wasDragging ? { type: 'drag-end', current: point } : { type: 'tap', at: origin }
  }

  /** Pointer lost (e.g. pointercancel / blur): end without a tap. */
  cancel(point?: PointerPoint): GestureEvent | null {
    const wasDragging = this.dragging
    this.origin = null
    this.dragging = false
    return wasDragging && point ? { type: 'drag-end', current: point } : null
  }
}
