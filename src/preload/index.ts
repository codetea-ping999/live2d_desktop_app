import { contextBridge, ipcRenderer } from 'electron'

// Minimal subset of `@electron-toolkit/preload` API to avoid requiring external
// modules in sandboxed preload mode (sandbox: true).
const electronAPI = {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrapped = (_event: unknown, ...args: unknown[]): void => listener(...args)
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    },
    once: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrapped = (_event: unknown, ...args: unknown[]): void => listener(...args)
      ipcRenderer.once(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    }
  },
  process: {
    get platform() {
      return process.platform
    },
    get versions() {
      return process.versions
    },
    get env() {
      return { ...process.env }
    }
  }
}

// System Metrics Type
export interface SystemMetrics {
  cpu: number // CPU使用率 (0-100)
  memory: number // メモリ使用率 (0-100)
  disk: number // ディスク使用率 (0-100)
  network: {
    rx: number // 受信速度 (Mbps)
    tx: number // 送信速度 (Mbps)
  }
  timestamp: number
}

export interface AutoFreePerformedPayload {
  result: {
    success: boolean
    message?: string
  }
  metrics: SystemMetrics
}

export interface MusicTrack {
  id: string
  title: string
  fileName: string
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OllamaChatResponse {
  model: string
  baseUrl: string
  reply: string
}

export interface OllamaStatus {
  baseUrl: string
  model: string
  availableModels: string[]
  modelAvailable: boolean
}

function subscribe<TArgs extends unknown[]>(
  channel: string,
  listener: (...args: TArgs) => void
): () => void {
  const wrapped = (_event: unknown, ...args: unknown[]): void => listener(...(args as TArgs))
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.off(channel, wrapped)
}

// Custom APIs for Live2D Desktop
const live2dAPI = {
  closeWindow: (): void => ipcRenderer.send('window:close'),
  minimizeWindow: (): void => ipcRenderer.send('window:minimize'),
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-always-on-top'),
  setIgnoreMouse: (ignore: boolean): void => ipcRenderer.send('window:set-ignore-mouse', ignore),
  /** ウィンドウを指定位置へ移動（画面座標のウィンドウ左上） */
  moveWindow: (x: number, y: number): void => ipcRenderer.send('window:move', x, y),
  getWindowBounds: (): Promise<{ x: number; y: number; width: number; height: number } | null> =>
    ipcRenderer.invoke('window:get-bounds'),
  getSettings: (): Promise<Record<string, unknown> | null> => ipcRenderer.invoke('settings:get'),
  setSettings: (data: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('settings:set', data),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('shortcuts:copy-to-clipboard', text),
  launchApp: (appNameOrPath: string): Promise<void> =>
    ipcRenderer.invoke('shortcuts:launch-app', appNameOrPath),
  // モデル一覧取得
  listModels: (): Promise<string[]> => ipcRenderer.invoke('models:list'),
  getModelEntry: (modelId: string): Promise<string | null> =>
    ipcRenderer.invoke('models:get-entry', modelId),
  getModelStoragePath: (): Promise<string> => ipcRenderer.invoke('models:get-storage-path'),
  openModelStoragePath: (): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke('models:open-storage-path'),
  importModelDirectory: (): Promise<{ success: boolean; modelId?: string; message?: string }> =>
    ipcRenderer.invoke('models:import-directory'),
  // モデル切替（ID指定で切替・永続化・通知）
  setModel: (modelId: string): Promise<boolean> => ipcRenderer.invoke('model:set', modelId),
  // モーション一覧取得
  listMotions: (modelId: string): Promise<string[]> => ipcRenderer.invoke('motions:list', modelId),
  listTracks: (): Promise<MusicTrack[]> => ipcRenderer.invoke('music:list'),
  getTrackEntry: (trackId: string): Promise<string | null> =>
    ipcRenderer.invoke('music:get-entry', trackId),
  getMusicStoragePath: (): Promise<string> => ipcRenderer.invoke('music:get-storage-path'),
  openMusicStoragePath: (): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke('music:open-storage-path'),
  importMusicFiles: (): Promise<{
    success: boolean
    tracks?: MusicTrack[]
    message?: string
  }> => ipcRenderer.invoke('music:import-files'),
  askOllama: (
    prompt: string,
    history?: OllamaMessage[]
  ): Promise<OllamaChatResponse> => ipcRenderer.invoke('ollama:chat', prompt, history ?? []),
  getOllamaStatus: (): Promise<OllamaStatus> => ipcRenderer.invoke('ollama:status'),
  // レンダラー側でモーション再生を要求（アダプタで実行）
  playMotion: (motionId: string): Promise<void> => {
    // NOTE: モーションの実際の再生は Live2DViewer コンポーネント内で行われる
    // ここでは単にモーション ID を renderer に通知する
    void motionId
    return Promise.resolve()
  },
  // renderer 側でモデル変更イベントを受け取るための登録
  onModelChanged: (cb: (modelId: string | null) => void): (() => void) =>
    subscribe('model:changed', cb),
  onAppOpenedUrl: (cb: (url: string) => void): (() => void) => subscribe('app:opened-url', cb),
  onAutoFreePerformed: (cb: (payload: AutoFreePerformedPayload) => void): (() => void) =>
    subscribe('system:auto-free-performed', cb),

  // Renderer -> Main console forwarding (renderer scripts can call `window.api.sendRendererLog`)
  sendRendererLog: (level: string, args: unknown[]): void =>
    ipcRenderer.send('renderer:console', { level, args }),

  // System Metrics API
  getSystemMetrics: (): Promise<SystemMetrics> => ipcRenderer.invoke('system:metrics'),
  startMonitoring: (): Promise<boolean> => ipcRenderer.invoke('system:start-monitoring'),
  // Free memory on demand (may be platform-limited)
  freeMemory: (): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke('system:free-memory'),
  // Auto-free controls: enable/disable and optional threshold percent
  setAutoFree: (
    enabled: boolean,
    threshold?: number
  ): Promise<{ enabled: boolean; threshold: number }> =>
    ipcRenderer.invoke('system:set-auto-free', enabled, threshold),
  getAutoFree: (): Promise<{ enabled: boolean; threshold: number }> =>
    ipcRenderer.invoke('system:get-auto-free')
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
