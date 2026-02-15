/**
 * アバターが「今どうあるべきか」を表す状態。
 * 制御レイヤーが生成し、Adapter が描画に反映する。
 */
export interface AvatarState {
  /** 視線・注視点 X（画面座標または正規化 -1〜1） */
  lookX: number
  /** 視線・注視点 Y */
  lookY: number
  /** 頭の角度（将来: カメラ入力用） */
  headAngle?: number
  /** 表情 ID（将来） */
  expression?: string
  /** 口の開閉 0〜1（将来: リップシンク） */
  mouthOpen?: number
  /** 現在再生中のモーション ID */
  currentMotionId?: string
}

/** 入力ソースが出力する意味データ（視線など） */
export interface InputPayload {
  lookX?: number
  lookY?: number
  headAngle?: number
  volume?: number
}
