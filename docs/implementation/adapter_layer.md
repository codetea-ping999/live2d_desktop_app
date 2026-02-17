# Adapter Layer — 実装確認

確認日: 2026-02-15

- 実装: `IAvatarAdapter` インターフェースおよび `Live2DAdapter` の実装があります。
  - `IAvatarAdapter`: src/renderer/src/adapters/types.ts
  - `Live2DAdapter`: src/renderer/src/adapters/Live2DAdapter.ts
- 仕様準拠事項:
  - `loadModel(path)`, `applyState(AvatarState)`, `hitTest(x,y)`, `playMotion(motionId)`, `destroy()` を提供している。
- 注意点:
  - `hitTest` と `applyState` は現在のアプリの座標系（ピクセル）を前提に動いている可能性があるため、座標系仕様を統一してください。
  - `playMotion` は現在同期呼び出し型。再生完了を `Promise` で返せるように拡張すると `MotionController` と連携しやすくなります。

参照: `src/renderer/src/adapters/Live2DAdapter.ts`
