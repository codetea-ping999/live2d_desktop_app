import type { AppSettings } from './types'
import { defaultSettings } from './types'

/** Electron の api が利用可能か（preload が注入済みか） */
function isApiAvailable(): boolean {
  return typeof window !== 'undefined' && window.api != null
}

/**
 * settings.json の読み書きを担当。IPC 経由でメインプロセスに委譲する。
 * api が未定義のときはデフォルト設定を返し、保存は何もしない。
 */
export async function loadSettings(): Promise<AppSettings> {
  if (!isApiAvailable()) return { ...defaultSettings }
  try {
    const raw = await window.api.getSettings()
    if (!raw || typeof raw !== 'object') return { ...defaultSettings }
    return {
      modelId: typeof raw.modelId === 'string' ? raw.modelId : defaultSettings.modelId,
      scale: typeof raw.scale === 'number' ? raw.scale : defaultSettings.scale,
      opacity: typeof raw.opacity === 'number' ? raw.opacity : defaultSettings.opacity
    }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isApiAvailable()) return
  await window.api.setSettings(settings as unknown as Record<string, unknown>)
}
