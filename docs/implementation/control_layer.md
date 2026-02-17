# Control Layer — 実装確認

確認日: 2026-02-15

- 実装: `AvatarController` と `MotionController` が存在し、制御レイヤーの責務を分担しています.
  - `AvatarController`: 入力のマージ・スムージング、`AvatarState` の保持。`src/renderer/src/core/AvatarController.ts`
  - `MotionController`: モーション再生の入口を担当。`src/renderer/src/core/MotionController.ts`
- 変更: `MotionController` を優先度/キュー対応へ拡張しました（非同期ハンドラ対応、キュー操作メソッド追加）。
- 注意点:
  - `MotionController` は再生ハンドラが Promise を返す場合に自動で次を再生します。同期ハンドラの場合はフォールバックで短時間後に終了扱いになります（デフォルト 1500ms）。
  - 必要に応じてアダプタ側で再生完了を Promise で返す実装を推奨します。

参照: `src/renderer/src/core/AvatarController.ts`, `src/renderer/src/core/MotionController.ts`
