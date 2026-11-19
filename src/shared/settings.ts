/**
 * Persisted settings schema, shared by main and renderer so defaults and
 * ranges live in exactly one place (#4, #5, #6, #7).
 */

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Settings {
  version: 1
  window: {
    /** Last known bounds; null means "use the default placement". */
    bounds: WindowBounds | null
    alwaysOnTop: boolean
  }
  character: {
    scale: number
    opacity: number
  }
  behavior: {
    clickThrough: boolean
  }
  model: {
    /** Selected model in the library (#9); null = first available. */
    selectedId: string | null
  }
}

export const SCALE_RANGE = { min: 0.1, max: 0.6, step: 0.01 } as const
export const OPACITY_RANGE = { min: 0.2, max: 1, step: 0.05 } as const
export const DEFAULT_WINDOW_SIZE = { width: 400, height: 500 } as const
export const MIN_WINDOW_SIZE = { width: 150, height: 150 } as const

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  version: 1,
  window: { bounds: null, alwaysOnTop: true },
  character: { scale: 0.25, opacity: 1 },
  behavior: { clickThrough: false },
  model: { selectedId: null }
}) as Settings

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Returns a valid scale, or null if the input is not a usable number. */
export function normalizeScale(value: unknown): number | null {
  return isFiniteNumber(value) ? clamp(value, SCALE_RANGE.min, SCALE_RANGE.max) : null
}

export function normalizeOpacity(value: unknown): number | null {
  return isFiniteNumber(value) ? clamp(value, OPACITY_RANGE.min, OPACITY_RANGE.max) : null
}

export function normalizeBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  if (![x, y, width, height].every(isFiniteNumber)) return null
  if ((width as number) < MIN_WINDOW_SIZE.width || (height as number) < MIN_WINDOW_SIZE.height) {
    return null
  }
  return {
    x: Math.round(x as number),
    y: Math.round(y as number),
    width: Math.round(width as number),
    height: Math.round(height as number)
  }
}

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i

export function normalizeModelId(value: unknown): string | null {
  return typeof value === 'string' && MODEL_ID_PATTERN.test(value) ? value : null
}

/**
 * Turn anything read from disk into valid Settings. Each field falls back to
 * its default on its own, so one bad value never resets everything.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  const root = isRecord(raw) ? raw : {}
  const win = isRecord(root.window) ? root.window : {}
  const character = isRecord(root.character) ? root.character : {}
  const behavior = isRecord(root.behavior) ? root.behavior : {}
  const model = isRecord(root.model) ? root.model : {}

  return {
    version: 1,
    window: {
      bounds: normalizeBounds(win.bounds),
      alwaysOnTop: typeof win.alwaysOnTop === 'boolean' ? win.alwaysOnTop : d.window.alwaysOnTop
    },
    character: {
      scale: normalizeScale(character.scale) ?? d.character.scale,
      opacity: normalizeOpacity(character.opacity) ?? d.character.opacity
    },
    behavior: {
      clickThrough:
        typeof behavior.clickThrough === 'boolean' ? behavior.clickThrough : d.behavior.clickThrough
    },
    model: {
      selectedId: normalizeModelId(model.selectedId)
    }
  }
}

export type CharacterSettingsPatch = Partial<Settings['character']>

/**
 * Validate a character patch coming from the renderer. Returns null if the
 * payload is malformed (wrong shape / unknown keys / non-numbers).
 */
export function parseCharacterPatch(value: unknown): CharacterSettingsPatch | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  if (keys.length === 0 || keys.some((k) => k !== 'scale' && k !== 'opacity')) return null
  const patch: CharacterSettingsPatch = {}
  if ('scale' in value) {
    const scale = normalizeScale(value.scale)
    if (scale === null) return null
    patch.scale = scale
  }
  if ('opacity' in value) {
    const opacity = normalizeOpacity(value.opacity)
    if (opacity === null) return null
    patch.opacity = opacity
  }
  return patch
}
