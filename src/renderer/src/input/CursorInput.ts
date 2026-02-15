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
      this.callback?.({
        lookX: e.clientX,
        lookY: e.clientY
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
