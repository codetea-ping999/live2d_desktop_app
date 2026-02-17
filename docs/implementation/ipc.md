# IPC — 実装確認

確認日: 2026-02-15

- 実装: レンダラー ↔ メイン間の IPC は設計書通りのチャンネルを提供しています。
  - `window:move` → メインで `setPosition` を実行: src/main/index.ts
  - `window:set-ignore-mouse` → メインで `setIgnoreMouseEvents` を実行: src/main/index.ts
  - `window:toggle-always-on-top` → メインで切替: src/main/index.ts
  - `settings:get` / `settings:set` → メインで `settings.json` に読み書き: src/main/index.ts
- Preload: `window.api` として安全に公開されています: src/preload/index.ts

参照: `src/main/index.ts`, `src/preload/index.ts`
