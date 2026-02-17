# MotionController — 変更記録

確認日: 2026-02-15

- 変更: `MotionController` を優先度付きキュー対応に拡張しました。
  - ファイル: src/renderer/src/core/MotionController.ts
- 新機能:
  - `playMotion(motionId, priority = 0)`：優先度を指定可能。
  - 内部キューにより高優先度順で待機。
  - 再生ハンドラが `Promise` を返す場合は解決時に自動で次を再生。
  - 同期ハンドラのためのフォールバック（1500ms）を実装。
  - メソッド `motionFinished()` を公開（外部から再生終了を通知可能）。
- 推奨: `Live2DAdapter.playMotion` を可能であれば `Promise<void>` を返す形に変更し、正確な再生完了通知を行うとより自然に動作します。

参照: `src/renderer/src/adapters/Live2DAdapter.ts`, `src/renderer/src/core/MotionController.ts`
