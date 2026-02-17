import type { AppShortcut, TemplateShortcut } from '../config/shortcuts'

export interface AppSettings {
  modelId: string
  scale: number
  opacity: number
  // カスタムショートカット
  appShortcuts?: AppShortcut[]
  templateShortcuts?: TemplateShortcut[]
  // 自動モーション (アイドル) 設定
  autoIdleEnabled?: boolean
  autoIdleIntervalSec?: number
}

export const defaultSettings: AppSettings = {
  modelId: 'miku',
  scale: 0.25,
  opacity: 1.0,
  appShortcuts: undefined,
  templateShortcuts: undefined,
  autoIdleEnabled: true,
  autoIdleIntervalSec: 20
}
