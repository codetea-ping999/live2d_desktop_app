import * as PIXI from 'pixi.js'
import { Live2DModel, cubism4Ready } from 'pixi-live2d-display/cubism4'
import type { IAvatarAdapter } from './types'
import type { AvatarState } from '../core/types'

Live2DModel.registerTicker(PIXI.Ticker)

export interface Live2DAdapterOptions {
  scale?: number
  opacity?: number
}

/**
 * Live2D 実装の Avatar Adapter。
 * loadModel / applyState / hitTest / playMotion を提供する。
 */
export class Live2DAdapter implements IAvatarAdapter {
  private canvas: HTMLCanvasElement
  private app: PIXI.Application | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null
  private scale: number
  private opacity: number
  private bornAt = performance.now()

  constructor(canvas: HTMLCanvasElement, options: Live2DAdapterOptions = {}) {
    this.canvas = canvas
    this.scale = options.scale ?? 0.25
    this.opacity = options.opacity ?? 1.0
  }

  async loadModel(path: string): Promise<void> {
    console.log('[Live2DAdapter] Starting model load:', { path })
    
    // Cubism SDK の準備完了を待つ
    try {
      console.log('[Live2DAdapter] Waiting for Cubism SDK...')
      await cubism4Ready()
      console.log('[Live2DAdapter] Cubism SDK ready')
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error('[Live2DAdapter] Cubism SDK initialization failed:', reason)
      throw new Error(`Cubism SDK initialization failed: ${reason}`)
    }

    // PIXI Application を初期化
    if (!this.app) {
      try {
        console.log('[Live2DAdapter] Initializing PIXI Application...')
        this.app = new PIXI.Application({
          view: this.canvas,
          backgroundAlpha: 0,
          resizeTo: window,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1
        })
        console.log('[Live2DAdapter] PIXI Application initialized')
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.error('[Live2DAdapter] PIXI initialization failed:', reason)
        throw new Error(`PIXI Application initialization failed: ${reason}`)
      }
    }

    if (this.model) {
      this.model.destroy()
      this.model = null
    }

    // パス候補を生成（相対パスを試す）
    const candidates = Array.from(
      new Set([
        path,
        path.startsWith('/') ? path : `/${path}`,
        path.startsWith('./') ? path : `./${path}`,
        // 絶対パスの場合は相対に変換
        path.startsWith('models/') ? path : null
      ])
    ).filter((p): p is string => p != null)

    console.log('[Live2DAdapter] Model load attempts:', candidates)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any = null
    const errors: Array<{ path: string; error: string }> = []

    for (const candidate of candidates) {
      try {
        console.log(`[Live2DAdapter] Attempting to load from: ${candidate}`)
        model = await Live2DModel.from(candidate, { autoInteract: false })
        console.log(`[Live2DAdapter] ✓ Successfully loaded from: ${candidate}`)
        break
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.warn(`[Live2DAdapter] ✗ Failed to load from ${candidate}:`, errMsg)
        errors.push({ path: candidate, error: errMsg })
      }
    }

    if (model == null) {
      const errorDetails = errors.map((e) => `${e.path}: ${e.error}`).join('; ')
      console.error('[Live2DAdapter] Model loading failed after all attempts:', errorDetails)
      throw new Error(`Failed to load model from ${path}. Attempts: ${errorDetails}`)
    }

    this.model = model
    this.app.stage.addChild(model)
    this.updateModelTransform()
    this.model.alpha = this.opacity
    this.model.scale.set(this.scale)

    console.log('[Live2DAdapter] Model fully loaded and configured')

    window.addEventListener('resize', this.updateModelTransform)
  }

  applyState(state: AvatarState): void {
    if (!this.model?.internalModel) return
    this.updateModelTransform()
    this.model.focus(state.lookX, state.lookY)
    const t = (performance.now() - this.bornAt) / 1000
    this.model.y += Math.sin(t * 1.2) * 2
    this.model.rotation = state.lookX * 0.03 + Math.sin(t * 0.8) * 0.01
  }

  hitTest(x: number, y: number): boolean {
    if (!this.model) return false
    const hit = this.model.hitTest(x, y)
    if (hit != null && hit.length > 0) return true
    // HitAreas が未定義のモデル用: 境界ボックスで判定
    if (typeof this.model.containsPoint === 'function') {
      return this.model.containsPoint(new PIXI.Point(x, y))
    }
    return false
  }

  async playMotion(motionId: string): Promise<void> {
    if (!this.model) return

    // pixi-live2d-display のモデルがモーション完了イベントを提供する場合を試す
    const internal = this.model.internalModel
    if (internal && typeof internal.motionManager !== 'undefined') {
      try {
        const motionMgr = internal.motionManager
        // ハンドラを登録してモーション再生
        return await new Promise<void>((resolve) => {
          const onComplete = (): void => {
            if (motionMgr && typeof motionMgr.off === 'function') {
              motionMgr.off('finish', onComplete)
            }
            resolve()
          }

          // イベントをリッスン
          if (motionMgr && typeof motionMgr.on === 'function') {
            motionMgr.on('finish', onComplete)
          }

          // モーション再生を試みる
          try {
            this.model.motion(motionId)
            // フォールバック: イベントがない場合はタイムアウトで resolve
            const timer = setTimeout(() => {
              if (motionMgr && typeof motionMgr.off === 'function') {
                motionMgr.off('finish', onComplete)
              }
              resolve()
            }, 2000)

            // onComplete が呼ばれたらタイマーをクリア
            const origResolve = resolve
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(resolve as any) = (v?: void | PromiseLike<void>): void => {
              clearTimeout(timer)
              origResolve(v)
            }
          } catch {
            resolve()
          }
        })
      } catch {
        // フォールバック
      }
    }

    // フォールバック: Promise を返す従来の方法
    try {
      const res = this.model.motion?.(motionId)
      if (res && typeof (res as Promise<void>).then === 'function') {
        await (res as Promise<void>)
        return
      }
    } catch {
      // ignore and try expression
    }

    try {
      const res2 = this.model.expression?.()
      if (res2 && typeof (res2 as Promise<void>).then === 'function') {
        await (res2 as Promise<void>)
        return
      }
    } catch {
      // ignore
    }

    // フォールバック: 非同期的に短時間待って終了とする
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }

  setScale(scale: number): void {
    this.scale = scale
    if (this.model) this.model.scale.set(scale)
    this.updateModelTransform()
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity
    if (this.model) this.model.alpha = opacity
  }

  private updateModelTransform = (): void => {
    if (!this.model) return
    this.model.scale.set(this.scale)
    const w = this.model.width
    const h = this.model.height
    // ロード直後は width/height が 0 のことがあるため、その間は安全側の位置に置く。
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 1 || h <= 1) {
      this.model.x = window.innerWidth * 0.5
      this.model.y = window.innerHeight * 0.9
      return
    }
    this.model.x = (window.innerWidth - w) / 2
    this.model.y = window.innerHeight - h
  }

  destroy(): void {
    window.removeEventListener('resize', this.updateModelTransform)
    if (this.model) {
      this.model.destroy()
      this.model = null
    }
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true })
      this.app = null
    }
  }
}
