
# プロジェクト概要: Live2D Desktop App

## 目標
Live2Dモデルを表示・操作できるデスクトップアプリケーションを作成する。

## 技術スタック (提案)
- **基盤**: Electron (クロスプラットフォームデスクトップアプリ開発)
- **フロントエンド**: React + TypeScript + Vite (UI開発の効率化)
- **レンダリング**: PixiJS (Live2Dモデルの描画ライブラリとして優秀)
- **Live2D SDK**: Cubism SDK for Web (Web技術での利用に必要)

## 必要要件・準備
1. **Node.js**: 開発環境に必須 (推奨: LTS版)
2. **PackageManager**: npm または yarn
3. **Live2D Cubism SDK**: [公式サイト](https://www.live2d.com/en/sdk/download/web/)からダウンロードが必要
4. **Live2Dモデル (.moc3)**: 表示するためのサンプルモデルまたは自作モデル
   - [Live2D Assets Search](https://www.google.com/search?q=live+2d+assets)

## 実装ステップ
1. **プロジェクト初期化**: Electron + Vite + React環境の構築
2. **SDK導入**: Live2D Cubism SDK for Webをプロジェクトに統合
3. **モデル表示**: PixiJSを使ってLive2Dモデルをキャンバスに描画
4. **ウィンドウ設定**: 背景透過、ウィンドウのドラッグ移動機能を追加
5. **インタラクション**: マウス追従、クリック時のモーション再生などを実装
6. **パッケージング**: アプリケーションとして配布可能な形式(.dmg/.app)にビルド

## 参考リンク
- [Live2D Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/)
- [pixi-live2d-display (有志ライブラリ)](https://github.com/guansss/pixi-live2d-display)