import type { IInputSource } from './types'
import type { InputPayload } from '../core/types'

/**
 * マウスカーソル座標を lookX / lookY の意味データとして出力する入力ソース。
 */
export class CursorInput implements IInputSource {
  private callback: ((payload: InputPayload) => void) | null = null
  private boundHandler: ((e: MouseEvent) => void) | null = null
  private started = false

  start(): void {
    if (this.started) return
    this.started = true
    this.boundHandler = (e: MouseEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      const nx = (e.clientX / w) * 2 - 1
      const ny = 1 - 2 * (e.clientY / h)
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      this.callback?.({
        lookX: clamp(nx),
        lookY: clamp(ny)
      })
    }
    window.addEventListener('mousemove', this.boundHandler)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    if (this.boundHandler) {
      window.removeEventListener('mousemove', this.boundHandler)
      this.boundHandler = null
    }
  }

  onUpdate(callback: (payload: InputPayload) => void): void {
    this.callback = callback
  }
}
