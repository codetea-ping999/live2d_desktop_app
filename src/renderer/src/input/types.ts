import type { InputPayload } from '../core/types'

/** 入力ソースの共通インターフェース（start / stop / onUpdate） */
export interface IInputSource {
  start(): void
  stop(): void
  onUpdate(callback: (payload: InputPayload) => void): void
}
