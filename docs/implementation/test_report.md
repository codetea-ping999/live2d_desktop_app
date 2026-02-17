# 動作確認レポート（草案）

確認日: 2026-02-15

- 予定する検証項目:
  1. アプリ起動（`npm run dev`）→ レンダラーが表示されるか
  2. モデルロード成功 / 失敗時の表示
  3. マウス追従（`CursorInput` 正規化前はピクセル挙動）
  4. クリック/ドラッグでウィンドウ移動が行われるか
  5. モーション再生要求の優先度/キュー挙動
  6. 透明部分でのマウス透過（`setIgnoreMouse`）

- 実行方法（ローカル）:

```bash
npm install
# 開発ホットリロードで起動
npm run dev
```

- 実行時の注意:
  - `src/renderer/public/lib/live2dcubismcore.min.js` が必要（docs の案内に従う）
  - モデルは `src/renderer/models/{modelId}/runtime/` 配下に正しいファイルが必要

- 実施後、ここに実行ログと問題点を追記します。
