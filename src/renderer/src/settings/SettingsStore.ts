import type { AppSettings } from './types'
import { defaultSettings } from './types'
import type { AppShortcut, TemplateShortcut } from '../config/shortcuts'

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

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
      scale:
        typeof raw.scale === 'number'
          ? clamp(raw.scale, 0.1, 0.6, defaultSettings.scale)
          : defaultSettings.scale,
      opacity:
        typeof raw.opacity === 'number'
          ? clamp(raw.opacity, 0.2, 1.0, defaultSettings.opacity)
          : defaultSettings.opacity,
      appShortcuts: Array.isArray(raw.appShortcuts) ? (raw.appShortcuts as AppShortcut[]) : undefined,
      templateShortcuts: Array.isArray(raw.templateShortcuts) ? (raw.templateShortcuts as TemplateShortcut[]) : undefined,
      autoIdleEnabled: typeof raw.autoIdleEnabled === 'boolean' ? raw.autoIdleEnabled : defaultSettings.autoIdleEnabled,
      autoIdleIntervalSec:
        typeof raw.autoIdleIntervalSec === 'number'
          ? clamp(raw.autoIdleIntervalSec, 5, 600, defaultSettings.autoIdleIntervalSec ?? 20)
          : defaultSettings.autoIdleIntervalSec
    }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isApiAvailable()) return
  await window.api.setSettings(settings as unknown as Record<string, unknown>)
}
