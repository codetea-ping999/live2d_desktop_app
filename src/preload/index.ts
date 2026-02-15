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
    ipcRenderer.invoke('shortcuts:launch-app', appNameOrPath)
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
