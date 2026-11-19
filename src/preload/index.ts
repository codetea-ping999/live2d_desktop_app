import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, type AppStateView, type DragMessage, type Live2DAPI } from '../shared/ipc'

// Custom APIs for Live2D Desktop
const live2dAPI: Live2DAPI = {
  getState: (): Promise<AppStateView> => ipcRenderer.invoke(IPC.getState),
  onStateChanged: (listener: (state: AppStateView) => void): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, state: AppStateView): void => listener(state)
    ipcRenderer.on(IPC.stateChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.stateChanged, wrapped)
    }
  },
  setAlwaysOnTop: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IPC.setAlwaysOnTop, value),
  setClickThrough: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IPC.setClickThrough, value),
  setPointerOverControls: (value: boolean): void =>
    ipcRenderer.send(IPC.setPointerOverControls, value),
  updateCharacter: (patch: { scale?: number; opacity?: number }): void =>
    ipcRenderer.send(IPC.updateCharacter, patch),
  drag: (message: DragMessage): void => ipcRenderer.send(IPC.drag, message),
  quit: (): void => ipcRenderer.send(IPC.quit),
  listModels: () => ipcRenderer.invoke(IPC.listModels),
  selectModel: (id: string) => ipcRenderer.invoke(IPC.selectModel, id),
  importModel: () => ipcRenderer.invoke(IPC.importModel)
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
