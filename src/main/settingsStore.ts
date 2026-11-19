import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { sanitizeSettings, type Settings } from '../shared/settings'

export interface SettingsStoreOptions {
  /** Delay before writing, so drag / slider bursts cause one write. */
  debounceMs?: number
  onError?: (error: unknown) => void
}

/**
 * JSON settings file under userData (#4, #5).
 * - unreadable / corrupt file → defaults (the bad file is kept as *.corrupt)
 * - writes are debounced and atomic (write tmp, then rename)
 */
export class SettingsStore {
  private settings: Settings
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs: number
  private readonly onError: (error: unknown) => void

  constructor(
    private readonly file: string,
    options: SettingsStoreOptions = {}
  ) {
    this.debounceMs = options.debounceMs ?? 400
    this.onError = options.onError ?? ((error) => console.error('[settings]', error))
    this.settings = this.read()
  }

  private read(): Settings {
    if (!existsSync(this.file)) return sanitizeSettings(undefined)
    try {
      return sanitizeSettings(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch (error) {
      this.onError(error)
      try {
        renameSync(this.file, `${this.file}.corrupt`)
      } catch {
        // ignore: we still start with defaults
      }
      return sanitizeSettings(undefined)
    }
  }

  get(): Settings {
    return this.settings
  }

  /** Apply a change; the result is re-validated before it is kept. */
  update(mutate: (current: Settings) => Settings): Settings {
    this.settings = sanitizeSettings(mutate(structuredClone(this.settings)))
    this.schedule()
    return this.settings
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.writeNow()
    }, this.debounceMs)
  }

  /** Write pending changes immediately (call on quit). */
  flush(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
    this.writeNow()
  }

  private writeNow(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, JSON.stringify(this.settings, null, 2), 'utf8')
      renameSync(tmp, this.file)
    } catch (error) {
      this.onError(error)
    }
  }
}
