import { ElectronAPI } from '@electron-toolkit/preload'
import type { Live2DAPI } from '../shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: Live2DAPI
  }
}
