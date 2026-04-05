import { ElectronAPI } from '@electron-toolkit/preload'

interface SystemMetrics {
  cpu: number // CPU使用率 (0-100)
  memory: number // メモリ使用率 (0-100)
  disk: number // ディスク使用率 (0-100)
  network: {
    rx: number // 受信速度 (Mbps)
    tx: number // 送信速度 (Mbps)
  }
  timestamp: number
}

interface AutoFreePerformedPayload {
  result: {
    success: boolean
    message?: string
  }
  metrics: SystemMetrics
}

interface MusicTrack {
  id: string
  title: string
  fileName: string
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatResponse {
  model: string
  baseUrl: string
  reply: string
}

interface OllamaStatus {
  baseUrl: string
  model: string
  availableModels: string[]
  modelAvailable: boolean
}

interface Live2DAPI {
  closeWindow: () => void
  minimizeWindow: () => void
  toggleAlwaysOnTop: () => Promise<boolean>
  setIgnoreMouse: (ignore: boolean) => void
  moveWindow: (x: number, y: number) => void
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
  getSettings: () => Promise<Record<string, unknown> | null>
  setSettings: (data: Record<string, unknown>) => Promise<void>
  copyToClipboard: (text: string) => Promise<void>
  launchApp: (appNameOrPath: string) => Promise<void>
  listModels: () => Promise<string[]>
  getModelEntry: (modelId: string) => Promise<string | null>
  getModelStoragePath: () => Promise<string>
  openModelStoragePath: () => Promise<{ success: boolean; message?: string }>
  importModelDirectory: () => Promise<{ success: boolean; modelId?: string; message?: string }>
  setModel: (modelId: string) => Promise<boolean>
  listMotions: (modelId: string) => Promise<string[]>
  listTracks: () => Promise<MusicTrack[]>
  getTrackEntry: (trackId: string) => Promise<string | null>
  getMusicStoragePath: () => Promise<string>
  openMusicStoragePath: () => Promise<{ success: boolean; message?: string }>
  importMusicFiles: () => Promise<{ success: boolean; tracks?: MusicTrack[]; message?: string }>
  askOllama: (prompt: string, history?: OllamaMessage[]) => Promise<OllamaChatResponse>
  getOllamaStatus: () => Promise<OllamaStatus>
  playMotion: (motionId: string) => Promise<void>
  onModelChanged?: (cb: (modelId: string | null) => void) => () => void
  onAppOpenedUrl?: (cb: (url: string) => void) => () => void
  onAutoFreePerformed?: (cb: (payload: AutoFreePerformedPayload) => void) => () => void
  sendRendererLog?: (level: string, args: unknown[]) => void
  getSystemMetrics: () => Promise<SystemMetrics>
  startMonitoring: () => Promise<boolean>
  freeMemory?: () => Promise<{ success: boolean; message?: string }>
  setAutoFree?: (
    enabled: boolean,
    threshold?: number
  ) => Promise<{ enabled: boolean; threshold: number }>
  getAutoFree?: () => Promise<{ enabled: boolean; threshold: number }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Live2DAPI
  }
}
