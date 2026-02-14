import { ElectronAPI } from '@electron-toolkit/preload'

interface Live2DAPI {
  closeWindow: () => void
  minimizeWindow: () => void
  toggleAlwaysOnTop: () => Promise<boolean>
  setIgnoreMouse: (ignore: boolean) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Live2DAPI
  }
}
