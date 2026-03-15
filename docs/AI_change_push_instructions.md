# AI変更整理・レビュー・コミット運用ガイド

- 作成日: 2026-03-16
- 目的: ワークツリーに残っている大きめの未整理変更を、AI に機能単位で見直し・修正・検証・コミット・push まで推進させるための実行指示を定義する。

## 基本方針

- 変更は必ず機能単位で分割する。1コミットに unrelated な変更を混ぜない。
- まず現状の差分を整理し、どのファイルがどの機能に属するかを明示する。
- 各機能について、実装確認、軽微修正、必要なテスト追加、検証、コミット、push を一気通貫で行う。
- 既存の未コミット変更は勝手に破棄しない。ユーザーが作業中の可能性を前提に扱う。
- push 前には、少なくとも対象変更に対して `test`、`typecheck`、`build` のいずれか必要な確認を実施する。
- 変更が大きい場合は、1回で全部やらず「機能Aを完了させてから次へ」の順で進める。

## このリポジトリでの推奨分割

### 1. セキュリティ・IPC・起動基盤

- 対象候補:
  - `src/main/index.ts`
  - `src/main/security.ts`
  - `src/preload/index.ts`
  - `src/preload/index.d.ts`
  - `src/renderer/src/env.d.ts`
  - `tests/security.test.ts`
- やること:
  - IPC の公開範囲と検証ロジックを見直す
  - 外部 URL / アプリ起動 / deep link の安全性を確認する
  - テストが不足していれば追加する

### 2. システムメトリクス・自動メモリ解放

- 対象候補:
  - `src/renderer/src/components/SystemGauges.tsx`
  - `src/renderer/src/components/SystemGauges.css`
  - `src/renderer/src/settings/SettingsStore.ts`
  - `src/renderer/src/settings/types.ts`
  - `src/renderer/src/settings/normalizeSettings.ts`
  - `tests/normalizeSettings.test.ts`
  - `SYSTEM_METRICS_FEATURE.md`
- やること:
  - 表示更新、設定永続化、自動解放フローを確認する
  - macOS 前提で失敗時の UI とメッセージ整合性を確認する
  - 関連設定の clamp と保存の整合性を検証する

### 3. 画像・ギャラリー・プロンプト導線

- 対象候補:
  - `src/renderer/src/App.tsx`
  - `src/renderer/src/components/ImageDock.tsx`
  - `src/renderer/src/components/ImageDock.css`
  - `src/renderer/src/components/ImageGallery.tsx`
  - `src/renderer/src/components/ImageGallery.css`
  - `src/renderer/src/components/ImageSettingsPanel.tsx`
  - `src/renderer/src/components/ImageSettingsPanel.css`
  - `src/renderer/src/components/PromptDock.tsx`
  - `src/renderer/src/components/PromptDock.css`
  - `src/renderer/src/gallery/promptArtwork.ts`
  - `src/renderer/src/gallery/types.ts`
  - `tests/imageGallery.test.ts`
- やること:
  - 画像追加、プレビュー保存、選択、削除、保存導線を確認する
  - `PromptDock` を使うのか、`ImageDock` / `ImageSettingsPanel` に統合するのか整理する
  - 使っていないコンポーネントがあれば削除候補として明示する

### 4. 音楽再生・トラック管理

- 対象候補:
  - `src/renderer/src/components/AudioDock.tsx`
  - `src/renderer/src/components/AudioDock.css`
  - `src/renderer/src/components/MusicSettingsPanel.tsx`
  - `src/renderer/src/components/MusicSettingsPanel.css`
  - `src/renderer/src/App.tsx`
  - `src/main/index.ts`
- やること:
  - 取り込み、選曲、再生/停止、次へ/前へ、shuffle、loop の整合性を確認する
  - 空状態と音源不正時の挙動を明確にする

### 5. Live2D 表示・操作・モデル切替

- 対象候補:
  - `src/renderer/src/components/Live2DViewer.tsx`
  - `src/renderer/src/adapters/Live2DAdapter.ts`
  - `src/renderer/src/input/DragInput.ts`
  - `src/renderer/src/components/ControlOverlay.tsx`
  - `src/renderer/src/assets/main.css`
  - `src/renderer/src/repository/modelSelection.ts`
  - `tests/modelSelection.test.ts`
- やること:
  - モデルロード、モーション、ドラッグ、透過、拡縮、常に手前表示まわりを確認する
  - 既存の Cubism / Pixi 回避コードが妥当か見直す

### 6. ビルド・配布・ドキュメント整備

- 対象候補:
  - `package.json`
  - `package-lock.json`
  - `electron-builder.yml`
  - `electron.vite.config.ts`
  - `README.md`
  - `.github/workflows/ci.yml`
  - `tsconfig.tests.json`
  - `docs/`
- やること:
  - 現在の実装と README / docs の乖離を解消する
  - CI に必要な最低限のチェックを揃える
  - 配布手順や必要ファイルの説明を最新化する

## AI に渡す実行ルール

- 1回の作業では「1機能グループだけ」を対象にする。
- 最初に対象ファイル一覧を出し、作業の境界を明示する。
- 対象外ファイルの差分は変更しない。
- 実装確認だけで終わらず、必要な修正と検証まで完了させる。
- コミット前に、何を直したか、何を確認したか、何が未確認かを短くまとめる。
- コミットメッセージは機能が分かる文にする。
  - 例: `Add system gauges and auto-free controls`
  - 例: `Harden IPC validation and external launch handling`
- branch 名は `codex/<feature-name>` とする。
- push 後は branch 名、commit hash、PR URL または compare URL を報告する。

## AI に要求する作業フロー

1. 現在の `git status --short` を確認する。
2. 対象機能に属するファイルだけを抽出する。
3. 実装を読み、未接続の UI、使われていないコード、危険な実装、テスト不足を洗い出す。
4. 必要な修正を加える。
5. 対象に応じて `npm test`、`npm run typecheck`、`npm run build`、必要なら lint を実行する。
6. 対象ファイルのみを `git add` する。
7. 機能単位のコミットを作る。
8. 指定 remote に branch を push する。
9. ユーザーへ以下を報告する。
   - 変更概要
   - 検証結果
   - 未確認事項
   - commit hash
   - branch 名
   - push 先 URL

## Codex / AI へのコピペ用指示

以下をそのまま AI に渡して使う。

```text
このリポジトリの未整理変更を、機能単位で1つずつ整理・修正・検証・コミット・pushしてください。

前提:
- 対象リポジトリ: /Users/toyoharukohyama/Documents/live2d_desktop_app
- remote: https://github.com/codetea-ping999/live2d_desktop_app.git
- 既存の未コミット変更は勝手に破棄しないこと
- 機能単位で分割し、対象外ファイルを巻き込まないこと
- 作業前に対象ファイルを明示すること

今回の対象機能:
- ここに 1 グループだけ書く

必須作業:
1. 現在の差分から、この機能に属するファイルだけを選別
2. 実装レビューして、壊れている点・未接続の UI・不要コード・不足テストを特定
3. 必要な修正を実装
4. 対象に必要なテスト、typecheck、build を実行
5. 対象ファイルだけ git add
6. `codex/<feature-name>` ブランチで分かりやすいコミットを作成
7. GitHub の指定 remote へ push
8. 最後に、変更概要・検証結果・未確認事項・commit hash・branch 名・URL を報告

出力ルール:
- まず対象ファイル一覧を出す
- 問題点は severity 順に出す
- 修正後は、実行した検証コマンドと結果を明記する
- できなかったことは曖昧にせず明記する
```

## このガイドの使い方

- まずは「セキュリティ・IPC・起動基盤」から着手する。
- 次に「システムメトリクス」か「画像・ギャラリー」を進める。
- `App.tsx` が複数機能にまたがる場合は、同じコミットで全部触らず、その機能に必要な最小変更に留める。
- ドキュメント系は最後にまとめて整える。
