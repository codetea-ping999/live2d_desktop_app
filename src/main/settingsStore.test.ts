import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { SettingsStore } from './settingsStore'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'live2d-settings-'))
  file = join(dir, 'nested', 'settings.json')
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('SettingsStore', () => {
  it('starts with defaults when there is no file', () => {
    expect(new SettingsStore(file).get()).toEqual(DEFAULT_SETTINGS)
  })

  it('persists after the debounce and restores on the next start', () => {
    const store = new SettingsStore(file, { debounceMs: 100 })
    store.update((s) => ({ ...s, character: { scale: 0.4, opacity: 0.6 } }))
    store.update((s) => ({ ...s, window: { ...s.window, alwaysOnTop: false } }))
    expect(existsSync(file)).toBe(false)
    vi.advanceTimersByTime(100)
    expect(existsSync(file)).toBe(true)
    const restored = new SettingsStore(file).get()
    expect(restored.character).toEqual({ scale: 0.4, opacity: 0.6 })
    expect(restored.window.alwaysOnTop).toBe(false)
  })

  it('coalesces bursts of updates into one write', () => {
    const store = new SettingsStore(file, { debounceMs: 100 })
    for (let i = 0; i < 50; i++) {
      store.update((s) => ({
        ...s,
        window: { ...s.window, bounds: { x: i, y: 0, width: 400, height: 500 } }
      }))
      vi.advanceTimersByTime(10)
    }
    expect(existsSync(file)).toBe(false)
    vi.advanceTimersByTime(100)
    expect(JSON.parse(readFileSync(file, 'utf8')).window.bounds.x).toBe(49)
  })

  it('flush() writes immediately', () => {
    const store = new SettingsStore(file)
    store.update((s) => ({ ...s, behavior: { clickThrough: true } }))
    store.flush()
    expect(JSON.parse(readFileSync(file, 'utf8')).behavior.clickThrough).toBe(true)
  })

  it('starts with defaults and keeps a backup when the file is corrupt', () => {
    const store1 = new SettingsStore(file)
    store1.update((s) => s)
    store1.flush()
    writeFileSync(file, '{ not json')
    const onError = vi.fn()
    const store = new SettingsStore(file, { onError })
    expect(store.get()).toEqual(DEFAULT_SETTINGS)
    expect(onError).toHaveBeenCalled()
    expect(readFileSync(`${file}.corrupt`, 'utf8')).toBe('{ not json')
  })

  it('re-validates values passed to update()', () => {
    const store = new SettingsStore(file)
    store.update((s) => ({ ...s, character: { scale: 50, opacity: Number.NaN } }))
    expect(store.get().character).toEqual({ scale: 0.6, opacity: 1 })
  })
})
