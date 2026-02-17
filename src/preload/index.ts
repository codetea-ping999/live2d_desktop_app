import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for Live2D Desktop
const live2dAPI = {
  closeWindow: (): void => ipcRenderer.send('window:close'),
  minimizeWindow: (): void => ipcRenderer.send('window:minimize'),
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-always-on-top'),
  setIgnoreMouse: (ignore: boolean): void =>
    ipcRenderer.send('window:set-ignore-mouse', ignore),
  /** ウィンドウを指定位置へ移動（画面座標のウィンドウ左上） */
  moveWindow: (x: number, y: number): void => ipcRenderer.send('window:move', x, y),
  getSettings: (): Promise<Record<string, unknown> | null> =>
    ipcRenderer.invoke('settings:get'),
  setSettings: (data: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('settings:set', data),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('shortcuts:copy-to-clipboard', text),
  launchApp: (appNameOrPath: string): Promise<void> =>
    ipcRenderer.invoke('shortcuts:launch-app', appNameOrPath),
  // モデル一覧取得
  listModels: (): Promise<string[]> =>
    ipcRenderer.invoke('models:list'),
  // モデル切替（ID指定で切替・永続化・通知）
  setModel: (modelId: string): Promise<boolean> =>
    ipcRenderer.invoke('model:set', modelId),
  // モーション一覧取得
  listMotions: (modelId: string): Promise<string[]> =>
    ipcRenderer.invoke('motions:list', modelId),
  // レンダラー側でモーション再生を要求（アダプタで実行）
  playMotion: (_motionId: string): Promise<void> => {
    // NOTE: モーションの実際の再生は Live2DViewer コンポーネント内で行われる
    // ここでは単にモーション ID を renderer に通知する
    return Promise.resolve()
  },
  // renderer 側でモデル変更イベントを受け取るための登録
  onModelChanged: (cb: (modelId: string) => void): (() => void) => {
    const handler = (_event: unknown, modelId: string) => cb(modelId)
    ipcRenderer.on('model:changed', handler)
    return () => ipcRenderer.off('model:changed', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', live2dAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = live2dAPI
}
