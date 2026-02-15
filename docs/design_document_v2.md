# Desktop Avatar Platform 設計書 (v2)

## 1. 三層アーキテクチャ方針
本プラットフォームは、入力・制御・描画を完全に分離した三層構造を採用する。

### 1.1 全体構造図
```mermaid
graph TD
    InputLayer[Input Layer] --> Controller[Avatar Control Layer]
    Controller --> Adapter[Avatar Adapter Layer]
    subgraph InputLayer
        Cursor[CursorInput]
        Camera[CameraInput - 将来]
        Audio[AudioInput - 将来]
    end
    subgraph Controller
        AvatarController
        MotionController
        AvatarState
    end
    subgraph Adapter
        Live2DAdapter
        VRMAdapter - 将来
    end
```

## 2. 各レイヤーの詳細

### 2.1 Input Layer
すべての入力ソースは共通インターフェース（`start()`, `stop()`, `onUpdate(callback)`）を持つ。
- **出力データ**: 物理的な生データ（座標等）ではなく、`lookX`, `lookY`, `headAngle`, `volume` 等の意味データに統一する。

### 2.2 Avatar Control Layer (中核)
- **AvatarController**: 入力ソースの優先順位（カメラ > カーソル等）を解決し、スムージングを適用した上で最新の **AvatarState** を保持する。
- **AvatarState**: アバターが「今どうあるべきか」を保持するデータクラス（視線、頭角、表情、口開閉、再生中モーションID）。
- **MotionController**: モーションの重複再生防止、優先度ベースの割り込み、キュー管理を担当。

### 2.3 Avatar Adapter Layer
- アバター実装（Live2D等）の差異を吸収する。
- **インターフェース**: `loadModel(path)`, `applyState(AvatarState)`, `hitTest(x, y)`, `playMotion(motionId)` を提供。
- Controller は Adapter が Live2D であるかを知らず、このインターフェースのみを通して操作する。

## 3. 主要機能の実装設計

### 3.1 ドラッグ＆ドロップによるウィンドウ移動
1. `DragInput` がドラッグを検知。
2. `AvatarAdapter.hitTest(x, y)` を呼び出し、キャラクター上であるか判定。
3. ヒットした場合、Renderer は IPC を介して Main プロセスに `window:move` を要求。
4. Main プロセスが `BrowserWindow.setPosition` を実行。

### 3.2 モデルと設定の管理
- `ModelRepository`: フォルダ構造（`models/{modelId}`）に基づきパスを解決。
- `SettingsStore`: `settings.json` の読み書きを担当。
- モデル差し替えフロー: `SettingsStore` の変更通知をトリガーに、`AvatarAdapter.loadModel` が実行される。

## 4. プロセス間通信 (IPC) 設計
| チャンネル | 方向 | 役割 |
| :--- | :--- | :--- |
| `window:move` | R -> M | ウィンドウを指定位置へ、またはドラッグ開始。 |
| `window:set-ignore-mouse` | R -> M | モデル外の透過部分でマウスイベントを背後へ流す。 |
| `window:toggle-always-on-top` | R -> M | 最前面表示の切り替え。 |

## 5. 同期・実行設計
- **入力系**: イベント駆動、または低頻度タイマーで `AvatarState` を非同期更新。
- **描画系**: `requestAnimationFrame` に同期したループで、その瞬間の `AvatarState` を `Adapter.applyState()` に流し込む。
- **堅牢性**: 入力信号が途絶えた場合、`AvatarController` が保持する直近のキャッシュデータ、または初期値を参照し、突然のフリーズを防ぐ。
