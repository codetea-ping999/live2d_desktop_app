import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  normalizeBounds,
  OPACITY_RANGE,
  parseCharacterPatch,
  sanitizeSettings,
  SCALE_RANGE
} from './settings'

describe('sanitizeSettings', () => {
  it('returns defaults for missing / corrupt input', () => {
    for (const raw of [undefined, null, 42, 'x', [], { version: 99 }]) {
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('keeps valid values', () => {
    const raw = {
      version: 1,
      window: { bounds: { x: 10, y: 20, width: 300, height: 400 }, alwaysOnTop: false },
      character: { scale: 0.4, opacity: 0.5 },
      behavior: { clickThrough: true },
      model: { selectedId: 'user:miku-1' }
    }
    expect(sanitizeSettings(raw)).toEqual(raw)
  })

  it('falls back per field instead of resetting everything', () => {
    const s = sanitizeSettings({
      window: { bounds: { x: 'a' }, alwaysOnTop: false },
      character: { scale: 'big', opacity: 0.5 },
      behavior: { clickThrough: 'yes' },
      model: { selectedId: '../../etc' }
    })
    expect(s.window).toEqual({ bounds: null, alwaysOnTop: false })
    expect(s.character).toEqual({ scale: DEFAULT_SETTINGS.character.scale, opacity: 0.5 })
    expect(s.behavior.clickThrough).toBe(false)
    expect(s.model.selectedId).toBeNull()
  })

  it('clamps scale / opacity into range and rejects NaN / Infinity', () => {
    expect(sanitizeSettings({ character: { scale: 99, opacity: -1 } }).character).toEqual({
      scale: SCALE_RANGE.max,
      opacity: OPACITY_RANGE.min
    })
    expect(sanitizeSettings({ character: { scale: NaN, opacity: Infinity } }).character).toEqual(
      DEFAULT_SETTINGS.character
    )
  })
})

describe('normalizeBounds', () => {
  it('rejects tiny or non-numeric bounds and rounds fractions', () => {
    expect(normalizeBounds({ x: 0, y: 0, width: 10, height: 10 })).toBeNull()
    expect(normalizeBounds({ x: 0, y: 0, width: '400', height: 500 })).toBeNull()
    expect(normalizeBounds({ x: 1.4, y: 2.6, width: 400.2, height: 500 })).toEqual({
      x: 1,
      y: 3,
      width: 400,
      height: 500
    })
  })
})

describe('parseCharacterPatch', () => {
  it('accepts partial valid patches and clamps them', () => {
    expect(parseCharacterPatch({ scale: 0.3 })).toEqual({ scale: 0.3 })
    expect(parseCharacterPatch({ opacity: 5 })).toEqual({ opacity: 1 })
  })

  it('rejects malformed payloads', () => {
    for (const bad of [null, 1, 'x', {}, { scale: 'x' }, { scale: 0.3, evil: true }, []]) {
      expect(parseCharacterPatch(bad)).toBeNull()
    }
  })
})
