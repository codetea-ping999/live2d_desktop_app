/**
 * モーションの重複再生防止、優先度ベースの割り込み、キュー管理を担当する。
 * 現状はシンプルに「再生要求」を Adapter に渡すだけ。将来キュー・優先度を拡張可能。
 */
export type PlayMotionRequest = {
  motionId: string
  priority?: number
}

export type MotionPlayHandler = (motionId: string) => void

export class MotionController {
  private playHandler: MotionPlayHandler
  private currentMotionId: string | null = null

  constructor(playHandler: MotionPlayHandler) {
    this.playHandler = playHandler
  }

  playMotion(motionId: string, _priority?: number): void {
    this.currentMotionId = motionId
    this.playHandler(motionId)
  }

  getCurrentMotionId(): string | null {
    return this.currentMotionId
  }
}
