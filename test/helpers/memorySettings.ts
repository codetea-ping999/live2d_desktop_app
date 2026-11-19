import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../../src/shared/settings'

/** SettingsStore without the file system. */
export class MemorySettings {
  writes = 0
  private settings: Settings

  constructor(initial: unknown = DEFAULT_SETTINGS) {
    this.settings = sanitizeSettings(initial)
  }
  get(): Settings {
    return this.settings
  }
  update(mutate: (s: Settings) => Settings): Settings {
    this.settings = sanitizeSettings(mutate(structuredClone(this.settings)))
    this.writes++
    return this.settings
  }
}
