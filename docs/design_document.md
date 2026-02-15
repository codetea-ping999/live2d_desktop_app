# Live2D Desktop App 設計書

## 1. システムアーキテクチャ
本アプリケーションは **Electron** フレームワークをベースに、**Vite** および **React** を用いて構築されている。

### 1.1 使用技術
- **Framework**: Electron
- **Bundler**: electron-vite (Vite)
- **Frontend Library**: React (TypeScript)
- **Rendering Engine**: PixiJS v7
- **Live2D Middleware**: pixi-live2d-display
- **SDK**: Live2D Cubism SDK for Web

## 2. プロセス構成

### 2.1 メインプロセス (`src/main/index.ts`)
- アプリケーションのライフサイクル管理。
- 透明・フレームレスなBrowserWindowの生成。
- システムトレイアイコンの生成とメニュー管理。
- IPC（Inter-Process Communication）のハンドリング。
    - ウィンドウ制御（最小化、終了、常に手前に表示）。
    - マウスイベントの透過設定（`setIgnoreMouseEvents`）。

### 2.2 プリロードスクリプト (`src/preload/index.ts`)
- メインプロセスとレンダラープロセスの安全な仲介（Context Isolation）。
- `window.api` を通じてElectronの機能をレンダラーに公開。

### 2.3 レンダラープロセス (`src/renderer/`)
- **App.tsx**: アプリケーションのルートコンポーネント。ステート（Scale, Opacity）の管理。
- **Live2DViewer.tsx**: PixiJSキャンバスを用いたモデルの描画。`pixi-live2d-display` を使用してモデルをロード・表示し、マウス追従ロジックを実装。
- **ControlOverlay.tsx**: ユーザー設定用のUI。モデルのスケールや不透明度を調整するスライダーを提供。

## 3. 主要な設計の詳細

### 3.1 透明ウィンドウの実装
- `BrowserWindow` 設定で `transparent: true`, `frame: false` を指定。
- macOSにおいて全てのデスクトップ（Workspaces）で表示されるよう `setVisibleOnAllWorkspaces` を使用。

### 3.2 モデルの描画と追従
- `pixi-live2d-display` により `model3.json` をロード。
- `PIXI.Application` 内でモデルを管理し、毎フレームの更新でマウス位置に視線を向ける。

### 3.3 マウスイベントの制御
- キャラクター以外の透明部分をクリックした際に背後のウィンドウを操作できるよう、マウスオーバー状態に応じてメインプロセスの `setIgnoreMouseEvents` を動的に切り替える。

## 4. ディレクトリ構造
```text
live2d-desktop-app/
├── docs/                # ドキュメント（要件定義・設計書）
├── src/
│   ├── main/           # メインプロセス
│   ├── preload/        # プリロードスクリプト
│   └── renderer/       # レンダラープロセス（Reactソース）
│       ├── public/     # 静的資産（SDK Coreなど）
│       └── src/
│           ├── components/ # Reactコンポーネント
│           └── assets/     # 画像・CSSなど
├── resources/          # アプリアイコン等
└── electron-builder.yml # ビルド設定
```
