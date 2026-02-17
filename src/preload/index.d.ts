import { ElectronAPI } from '@electron-toolkit/preload'

interface Live2DAPI {
  closeWindow: () => void
  minimizeWindow: () => void
  toggleAlwaysOnTop: () => Promise<boolean>
  setIgnoreMouse: (ignore: boolean) => void
  moveWindow: (x: number, y: number) => void
  getSettings: () => Promise<Record<string, unknown> | null>
  setSettings: (data: Record<string, unknown>) => Promise<void>
  copyToClipboard: (text: string) => Promise<void>
  launchApp: (appNameOrPath: string) => Promise<void>
  listModels: () => Promise<string[]>
  setModel: (modelId: string) => Promise<boolean>
  listMotions: (modelId: string) => Promise<string[]>
  playMotion: (motionId: string) => Promise<void>
  onModelChanged?: (cb: (modelId: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Live2DAPI
  }
}
