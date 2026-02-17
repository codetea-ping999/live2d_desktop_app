# Input Layer — 実装確認

確認日: 2026-02-15

- 実装: `IInputSource` インターフェースを実装する `CursorInput` と `DragInput` が存在します。
  - ファイル: src/renderer/src/input/types.ts
  - 実装: src/renderer/src/input/CursorInput.ts, src/renderer/src/input/DragInput.ts
- 仕様準拠事項:
  - `start()`, `stop()`, `onUpdate(callback)` を満たしている。
  - 出力は `InputPayload`（`lookX`, `lookY`, `headAngle`, `volume`）の形式。
- 注意点:
  - 現状 `CursorInput` は `clientX/clientY` をそのまま出力している（ピクセル座標）。座標系の正規化は未実装（別途仕様書で合意して実装予定）。

参照: `src/renderer/src/input/CursorInput.ts`
