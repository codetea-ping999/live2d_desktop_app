## 実装・更新履歴（2026-02-16）

以下は今回リポジトリへ反映した実装内容と、今後の作業候補です。

### 実装済み（今回反映）
- 設定（`AppSettings`）の拡張
  - `appShortcuts` / `templateShortcuts` / `autoIdleEnabled` / `autoIdleIntervalSec` を追加
  - 関連ファイル: `src/renderer/src/settings/types.ts`, `src/renderer/src/settings/SettingsStore.ts`
- Preload API にモデル変更購読を追加
  - `onModelChanged` を追加し、レンダラーがメインからのモデル切替通知を受け取れるように
  - 関連ファイル: `src/preload/index.ts`, `src/preload/index.d.ts`
- メインプロセスでモデル一覧取得とモデル切替（永続化＋通知）を追加
  - `listModels()` ヘルパー、`persistModelAndNotify()`、`ipcMain.handle('model:set')` の追加
  - トレイメニューにモデル選択サブメニューを追加（ラジオ）して選択時に永続化・通知
  - 関連ファイル: `src/main/index.ts`
- Live2D Viewer に自動アイドルモーションのループを追加
  - 設定 `autoIdleEnabled` / `autoIdleIntervalSec` を参照してアイドルモーションを定期再生
  - タイマーはコンポーネント破棄時にクリアする実装
  - 関連ファイル: `src/renderer/src/components/Live2DViewer.tsx`
- レンダラー側でモデル切替イベントを購読し、`App` の設定を更新するように実装
  - 関連ファイル: `src/renderer/src/App.tsx`

### 影響確認
- TypeScript の型チェックは実行済みでエラーは検出されていません（`npm run typecheck` 実行）。
- 開発サーバーと Electron の dev 起動が成功しています（ポートが利用中の場合は自動で別ポートを使用）。

### 今後の作業候補（優先度・見積）
1. ショートカット編集 UI（高） — `ControlOverlay` または専用設定画面で `appShortcuts` / `templateShortcuts` を編集・保存できるようにする（見積: 1.5〜2日）
2. モデル切替 UI 強化（中） — トレイメニューに加えてアプリ内でモデルサムネ/一覧を表示し切替できるようにする（見積: 1日）
3. モーション一覧と手動再生 UI（中） — モデルに含まれるモーションを検出して UI で再生/停止できるようにする（見積: 1〜2日）
4. モーション再生のフィードバック（低） — 再生中インジケータや履歴表示など（見積: 0.5日）
5. E2Eまたはインテグレーションテスト（低） — モデルロード・モーション再生・モデル切替の自動化検証（見積: 2日）

### すぐにできる検証手順（ローカル）
1. 依存をインストール
```
npm install
```
2. 型チェック
```
npm run typecheck
```
3. 開発起動
```
npm run dev
```

### 参照ファイル（主要）
- `src/main/index.ts` — モデル一覧、トレイメニュー、モデル永続化/通知
- `src/preload/index.ts` — レンダラー向け API（`onModelChanged` 等）
- `src/renderer/src/settings/*` — 設定の保存・型定義
- `src/renderer/src/components/Live2DViewer.tsx` — 自動アイドル再生ループ
- `src/renderer/src/components/ControlOverlay.tsx` — ショートカット表示 / 設定パネル

---

必要なら上記の「今後の作業候補」から優先度順で着手して実装します。どれを先に進めましょうか？
