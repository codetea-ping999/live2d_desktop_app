import type { AvatarState } from '../core/types'

/**
 * アバター実装（Live2D 等）の差異を吸収する Adapter インターフェース。
 * Controller は Adapter が Live2D であるかを知らず、このインターフェースのみで操作する。
 */
export interface IAvatarAdapter {
  /** モデルを指定パスでロードする */
  loadModel(path: string): Promise<void>
  /** 現在の AvatarState をアバターに反映・描画する */
  applyState(state: AvatarState): void
  /** 指定座標がキャラクター上かどうか判定する */
  hitTest(x: number, y: number): boolean
  /** 指定 ID のモーションを再生する */
  playMotion(motionId: string): void | Promise<void>
  /** 破棄・アンロード */
  destroy(): void
}
