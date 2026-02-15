export interface AppSettings {
  modelId: string
  scale: number
  opacity: number
}

export const defaultSettings: AppSettings = {
  modelId: 'miku',
  scale: 0.25,
  opacity: 1.0
}
