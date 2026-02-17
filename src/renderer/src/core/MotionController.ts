/**
 * モーションの重複再生防止、優先度ベースの割り込み、キュー管理を担当する。
 * 現状はシンプルに「再生要求」を Adapter に渡すだけ。将来キュー・優先度を拡張可能。
 */
export type PlayMotionRequest = {
  motionId: string
  priority?: number
}

export type MotionPlayHandler = (motionId: string) => void | Promise<void>

/**
 * MotionController
 * - 優先度付きキューを保持
 * - 高優先度の再生要求は現在のモーションを割り込み再生する
 * - 再生ハンドラが Promise を返す場合は自動で次キューを再生する
 */
export class MotionController {
  private playHandler: MotionPlayHandler
  private queue: PlayMotionRequest[] = []
  private currentMotionId: string | null = null
  private currentPriority = 0
  private fallbackTimeout = 1500
  private currentFallbackTimer: ReturnType<typeof setTimeout> | null = null

  constructor(playHandler: MotionPlayHandler) {
    this.playHandler = playHandler
  }

  /** 再生要求を行う。priority が大きいほど優先される（デフォルト 0）。 */
  playMotion(motionId: string, priority = 0): void {
    const req: PlayMotionRequest = { motionId, priority }

    // 再生中のモーションが無ければ即再生
    if (this.currentMotionId === null) {
      this.startRequest(req)
      return
    }

    // 優先度が高ければ現在のモーションを割り込み、現在のモーションはキューへ戻す
    if (priority > this.currentPriority) {
      const prev: PlayMotionRequest = {
        motionId: this.currentMotionId,
        priority: this.currentPriority
      }
      // 優先度の高い要求を先に実行
      this.queue.unshift(prev)
      this.startRequest(req)
      return
    }

    // そうでなければキューに追加（高い優先度順、同一優先度はFIFO）
    this.enqueue(req)
  }

  getCurrentMotionId(): string | null {
    return this.currentMotionId
  }

  /** 通知: 現在のモーションが終了した（外部から呼ぶか、playHandler の Promise 解決で自動呼出し） */
  motionFinished(): void {
    this.clearCurrentFallback()
    this.currentMotionId = null
    this.currentPriority = 0
    const next = this.dequeue()
    if (next) this.startRequest(next)
  }

  private startRequest(req: PlayMotionRequest): void {
    this.clearCurrentFallback()
    this.currentMotionId = req.motionId
    this.currentPriority = req.priority ?? 0

    // 呼び出しは同期/非同期どちらにも対応
    try {
      const res = this.playHandler(req.motionId)
      if (res && typeof (res as Promise<void>).then === 'function') {
        ;(res as Promise<void>).then(() => this.motionFinished()).catch(() => this.motionFinished())
      } else {
        // ハンドラが同期の場合はフォールバックで終了を想定
        this.currentFallbackTimer = setTimeout(() => this.motionFinished(), this.fallbackTimeout)
      }
    } catch {
      // エラーが起きてもキュー継続
      this.motionFinished()
    }
  }

  private enqueue(req: PlayMotionRequest): void {
    // 高優先度順に挿入
    let inserted = false
    for (let i = 0; i < this.queue.length; i++) {
      const q = this.queue[i]
      const qPri = q.priority ?? 0
      if ((req.priority ?? 0) > qPri) {
        this.queue.splice(i, 0, req)
        inserted = true
        break
      }
    }
    if (!inserted) this.queue.push(req)
  }

  private dequeue(): PlayMotionRequest | null {
    return this.queue.shift() ?? null
  }

  private clearCurrentFallback(): void {
    if (this.currentFallbackTimer) {
      clearTimeout(this.currentFallbackTimer)
      this.currentFallbackTimer = null
    }
  }

  /** キューを全消去する */
  clearQueue(): void {
    this.queue = []
  }
}
