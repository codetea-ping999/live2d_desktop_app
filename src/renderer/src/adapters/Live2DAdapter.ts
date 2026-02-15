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

  constructor(canvas: HTMLCanvasElement, options: Live2DAdapterOptions = {}) {
    this.canvas = canvas
    this.scale = options.scale ?? 0.25
    this.opacity = options.opacity ?? 1.0
  }

  async loadModel(path: string): Promise<void> {
    await cubism4Ready()

    if (!this.app) {
      this.app = new PIXI.Application({
        view: this.canvas,
        backgroundAlpha: 0,
        resizeTo: window,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1
      })
    }

    if (this.model) {
      this.model.destroy()
      this.model = null
    }

    const model = await Live2DModel.from(path, { autoInteract: false })
    if (!model) throw new Error('Model failed to load (returned null).')

    this.model = model
    this.app.stage.addChild(model)
    this.updateModelTransform()
    this.model.alpha = this.opacity
    this.model.scale.set(this.scale)

    window.addEventListener('resize', this.updateModelTransform)
  }

  applyState(state: AvatarState): void {
    if (!this.model?.internalModel) return
    this.model.focus(state.lookX, state.lookY)
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

  playMotion(motionId: string): void {
    if (!this.model) return
    // モーショングループ名（Tap, Flick, Idle 等）で再生。なければ expression
    try {
      this.model.motion(motionId)
    } catch {
      try {
        this.model.expression()
      } catch {
        // ignore
      }
    }
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
