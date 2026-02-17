# UI/UX 改善 — 実装変更記録

確認日: 2026-02-15

## 1. アプリケーション終了ダイアログ

**変更:** `ControlOverlay` の Close/Quit ボタンに確認ダイアログを追加。

```typescript
const handleClose = useCallback(() => {
  if (confirm('アプリケーションを終了しますか？')) {
    window.api?.closeWindow?.()
  }
}, [])
```

**効果:** 誤クリックによる意図しない閉じ込みを防止。
**ファイル:** `src/renderer/src/components/ControlOverlay.tsx`

---

## 2. 設定パネルのロック機能

**変更:** 設定パネル内をクリックするとパネルがロック（展開状態を維持）、再度クリック条件でアンロック。

**実装詳細:**
- `isPanelLocked` 状態を追加。
- `control-panel` の `onClick` でロック状態を有効にする。
- `onMouseLeave` でロック解除。
- "Close Panel" ボタンを追加してユーザーが明示的にロック解除可能。

**ファイル:** `src/renderer/src/components/ControlOverlay.tsx`

**CSS:** `close-panel-btn` スタイルを新規追加（オレンジ色）。

---

## 3. モーション完了検出の強化

**変更:** `Live2DAdapter.playMotion` をモデルのモーション完了イベント（`motionManager.finish`）で正確に検出。

**実装詳細:**
1. `model.internalModel.motionManager` が存在する場合、`finish` イベントをリッスン。
2. `Promise` を返して完了時に resolve。
3. イベントがない場合のフォールバック（2000ms タイムアウト）を用意。
4. 非同期ハンドラをサポート。

**効果:** モーション再生後のキュー管理が正確に動作。
**ファイル:** `src/renderer/src/adapters/Live2DAdapter.ts`

---

## 4. 座標正規化（CursorInput）

**変更:** マウス座標を正規化座標（-1🔄1）に変換。

```typescript
const w = window.innerWidth || 1
const h = window.innerHeight || 1
const nx = (e.clientX / w) * 2 - 1
const ny = 1 - 2 * (e.clientY / h)
```

**効果:** モデル実装に依存しない入力表現を確立。

---

## 参照ファイル
- `src/renderer/src/components/ControlOverlay.tsx`
- `src/renderer/src/adapters/Live2DAdapter.ts`
- `src/renderer/src/input/CursorInput.ts`
- `src/renderer/src/assets/main.css`
