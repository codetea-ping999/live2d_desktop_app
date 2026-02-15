/**
 * ドラッグを検知し、キャラクター上でのドラッグ時にウィンドウ移動を要求する。
 * hitTest でキャラ上か判定し、ドラッグ中は window:move を送る。
 */
export interface DragInputOptions {
  /** 指定座標がキャラクター上かどうか */
  hitTest: (x: number, y: number) => boolean
  /** ウィンドウを指定位置へ移動する要求（画面座標のウィンドウ左上） */
  onWindowMove: (windowX: number, windowY: number) => void
}

export class DragInput {
  private options: DragInputOptions
  private dragging = false
  private startClientX = 0
  private startClientY = 0
  private boundDown: ((e: MouseEvent) => void) | null = null
  private boundMove: ((e: MouseEvent) => void) | null = null
  private boundUp: ((e: MouseEvent) => void) | null = null
  private started = false

  constructor(options: DragInputOptions) {
    this.options = options
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.boundDown = (e: MouseEvent) => this.handleMouseDown(e)
    this.boundMove = (e: MouseEvent) => this.handleMouseMove(e)
    this.boundUp = () => this.handleMouseUp()
    window.addEventListener('mousedown', this.boundDown)
    window.addEventListener('mousemove', this.boundMove)
    window.addEventListener('mouseup', this.boundUp)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.dragging = false
    if (this.boundDown) window.removeEventListener('mousedown', this.boundDown)
    if (this.boundMove) window.removeEventListener('mousemove', this.boundMove)
    if (this.boundUp) window.removeEventListener('mouseup', this.boundUp)
    this.boundDown = null
    this.boundMove = null
    this.boundUp = null
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.dragging) return
    if (!this.options.hitTest(e.clientX, e.clientY)) return
    this.dragging = true
    this.startClientX = e.clientX
    this.startClientY = e.clientY
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.dragging) return
    // ウィンドウの新しい左上 = マウスの画面座標 - ドラッグ開始時のクライアント座標
    const windowX = e.screenX - this.startClientX
    const windowY = e.screenY - this.startClientY
    this.options.onWindowMove(windowX, windowY)
  }

  private handleMouseUp(): void {
    this.dragging = false
  }
}
