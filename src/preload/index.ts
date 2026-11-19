import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for Live2D Desktop
const live2dAPI = {
  closeWindow: (): void => ipcRenderer.send('window:close'),
  minimizeWindow: (): void => ipcRenderer.send('window:minimize'),
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-always-on-top'),
  setIgnoreMouse: (ignore: boolean): void => ipcRenderer.send('window:set-ignore-mouse', ignore)
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
