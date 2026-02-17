# 座標系仕様（合意案）

確認日: 2026-02-15

目的: `lookX` / `lookY` の意味・単位を明確にし、`CursorInput` と `Live2DAdapter` の正規化/マッピング実装を分担できるようにする。

合意事項（今回決定）:
- `AvatarState.lookX`, `AvatarState.lookY` の表現は **正規化座標（-1.0〜+1.0）** とする。
  - 0,0 が画面（ウィンドウ）中央。
  - X: -1 が左端、+1 が右端。
  - Y: -1 が下端、+1 が上端（描画系の慣習に合わせる）。
- `CursorInput` の実装方針 (あなたが実装する部分):
  - `clientX, clientY` をウィンドウサイズで正規化して `lookX`, `lookY` を出力する。
  - 例: lookX = (clientX / window.innerWidth) * 2 - 1
  - lookY = ((clientY / window.innerHeight) * 2 - 1) * -1  （Y軸反転を適用する場合は実装で調整）
- `Live2DAdapter.applyState(state)` は `AvatarState` の正規化値を受け取り、内部でモデルローカル座標にマッピングして `model.focus(...)` 等を呼ぶ。
  - Adapter 側でスケールやモデルサイズを考慮した変換を行うこと。

理由:
- 正規化によりモデル実装（解像度・サイズ）に依存しない入力表現となり、将来のカメラ入力や別アダプタへの移植が容易になります。

次の実装作業（提案）:
- あなたが `CursorInput` を正規化して `AvatarState` を出す。
- `Live2DAdapter.applyState` 側で受け取りを検証し、必要であれば小さな変換（反転・オフセット）を適用する。

参照: `src/renderer/src/core/types.ts`, `src/renderer/src/input/CursorInput.ts`, `src/renderer/src/adapters/Live2DAdapter.ts`
