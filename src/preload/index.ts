/**
 * The only bridge between the renderer and Electron (#16).
 *
 * Runs with `sandbox: true`, so it may import nothing but 'electron' (shared
 * modules are bundled in). The renderer gets a typed, fixed set of functions
 * on `window.api`; it never sees ipcRenderer or any generic send/invoke.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppStateView, type Live2DAPI } from '../shared/ipc'

const live2dAPI: Live2DAPI = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  onStateChanged: (listener) => {
    const wrapped = (_event: IpcRendererEvent, state: AppStateView): void => listener(state)
    ipcRenderer.on(IPC.stateChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC.stateChanged, wrapped)
    }
  },
  setAlwaysOnTop: (value) => ipcRenderer.invoke(IPC.setAlwaysOnTop, value),
  setClickThrough: (value) => ipcRenderer.invoke(IPC.setClickThrough, value),
  setPointerOverControls: (value) => ipcRenderer.send(IPC.setPointerOverControls, value),
  updateCharacter: (patch) => ipcRenderer.send(IPC.updateCharacter, patch),
  drag: (message) => ipcRenderer.send(IPC.drag, message),
  quit: () => ipcRenderer.send(IPC.quit),
  listModels: () => ipcRenderer.invoke(IPC.listModels),
  selectModel: (id) => ipcRenderer.invoke(IPC.selectModel, id),
  importModel: () => ipcRenderer.invoke(IPC.importModel)
}

// contextIsolation is always on; there is deliberately no fallback that
// would attach the API to a shared window object.
contextBridge.exposeInMainWorld('api', Object.freeze(live2dAPI))
