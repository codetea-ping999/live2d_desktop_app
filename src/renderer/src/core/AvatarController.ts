import type { AvatarState, InputPayload } from './types'
import type { IInputSource } from '../input/types'

const defaultState: AvatarState = {
  lookX: 0,
  lookY: 0
}

/** スムージング係数 (0〜1)。大きいほど反応が速い */
const SMOOTH_FACTOR = 0.15

/**
 * 入力ソースの優先順位を解決し、スムージングをかけた最新の AvatarState を保持する。
 * 入力が途絶えてもキャッシュで自然な挙動を維持する。
 */
export class AvatarController {
  private state: AvatarState = { ...defaultState }
  private input: IInputSource
  private smoothing: boolean

  constructor(input: IInputSource, options?: { smoothing?: boolean }) {
    this.input = input
    this.smoothing = options?.smoothing ?? true
    this.input.onUpdate((payload: InputPayload) => this.mergeInput(payload))
  }

  /** 現在の AvatarState を返す（描画ループから参照） */
  getState(): AvatarState {
    return { ...this.state }
  }

  /** 入力ソースを開始する */
  start(): void {
    this.input.start()
  }

  /** 入力ソースを停止する */
  stop(): void {
    this.input.stop()
  }

  /** 状態を外部から更新（例: モーション ID） */
  setState(partial: Partial<AvatarState>): void {
    this.state = { ...this.state, ...partial }
  }

  private mergeInput(payload: InputPayload): void {
    if (payload.lookX !== undefined && payload.lookY !== undefined) {
      if (this.smoothing) {
        this.state.lookX += (payload.lookX - this.state.lookX) * SMOOTH_FACTOR
        this.state.lookY += (payload.lookY - this.state.lookY) * SMOOTH_FACTOR
      } else {
        this.state.lookX = payload.lookX
        this.state.lookY = payload.lookY
      }
    }
    if (payload.headAngle !== undefined) this.state.headAngle = payload.headAngle
    if (payload.volume !== undefined) this.state.mouthOpen = Math.min(1, Math.max(0, payload.volume))
  }
}
