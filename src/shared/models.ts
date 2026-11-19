/**
 * Local Live2D model library: shared types and pure rules (#9, #10).
 *
 * Layout (user library):
 *   <userData>/models/<dir>/
 *     metadata.json          ← written on import
 *     <entry>.model3.json | model.json
 *     textures/ motions/ expressions/ …  (only files the entry references)
 *
 * Bundled models (read-only) live in `resources/models/<dir>/` when packaged,
 * or `src/renderer/models/<dir>/` in development, and need no metadata.
 */

export const MODEL_PROTOCOL = 'live2d-model'

export type ModelSource = 'user' | 'bundled'
export type CubismVersion = 2 | 4

export interface ModelMetadata {
  schema: 1
  name: string
  /** Entry JSON path relative to the model directory (POSIX separators). */
  entry: string
  cubismVersion: CubismVersion
  importedAt: string
}

export interface ModelSummary {
  /** Stable ID used in settings: "<source>:<slug>". */
  id: string
  name: string
  source: ModelSource
  cubismVersion: CubismVersion
  /** URL the renderer loads (custom protocol, works offline). */
  url: string
}

export interface ModelListResult {
  models: ModelSummary[]
  selectedId: string | null
}

export type ImportResult =
  | { status: 'imported'; model: ModelSummary }
  | { status: 'canceled' }
  | { status: 'error'; message: string }

const ID_SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/
export const MODEL_ID_PATTERN = /^(user|bundled):[a-z0-9][a-z0-9._-]{0,63}$/

/** Lowercase ASCII slug for directory names / IDs; never empty. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
  return ID_SLUG.test(slug) ? slug : 'model'
}

/** First free slug: "miku", "miku-2", "miku-3", … */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const slug = slugify(base)
  if (!used.has(slug)) return slug
  for (let i = 2; ; i++) {
    const candidate = `${slug}-${i}`
    if (!used.has(candidate)) return candidate
  }
}

export function modelId(source: ModelSource, slug: string): string {
  return `${source}:${slug}`
}

export function entryVersion(fileName: string): CubismVersion | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.model3.json')) return 4
  if (lower === 'model.json' || lower.endsWith('.model.json')) return 2
  return null
}

/**
 * Pick the entry among candidate relative paths: Cubism 4 first, then the
 * shallowest path, then alphabetical — deterministic for the same folder.
 */
export function pickEntry(paths: string[]): { entry: string; version: CubismVersion } | null {
  const candidates = paths
    .map((p) => ({ entry: p, version: entryVersion(p.split('/').pop() ?? p) }))
    .filter((c): c is { entry: string; version: CubismVersion } => c.version !== null)
  candidates.sort(
    (a, b) =>
      b.version - a.version ||
      a.entry.split('/').length - b.entry.split('/').length ||
      a.entry.localeCompare(b.entry)
  )
  return candidates[0] ?? null
}

export interface ReferencedFiles {
  /** Files the model cannot load without. */
  required: string[]
  /** Files that are nice to have (sounds): skipped if missing. */
  optional: string[]
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function rec(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * List files referenced by an entry JSON (paths relative to the entry's dir).
 * Throws a user-facing Error when the JSON lacks the moc or textures.
 */
export function collectReferencedFiles(json: unknown, version: CubismVersion): ReferencedFiles {
  const root = rec(json)
  const required: string[] = []
  const optional: string[] = []
  const push = (list: string[], value: unknown): void => {
    const s = str(value)
    if (s && !list.includes(s)) list.push(s)
  }

  if (version === 4) {
    const refs = rec(root.FileReferences)
    if (!str(refs.Moc)) throw new Error('The .model3.json has no FileReferences.Moc entry.')
    if (arr(refs.Textures).length === 0) throw new Error('The .model3.json lists no textures.')
    push(required, refs.Moc)
    arr(refs.Textures).forEach((t) => push(required, t))
    for (const key of ['Physics', 'Pose', 'DisplayInfo', 'UserData']) push(required, refs[key])
    arr(refs.Expressions).forEach((e) => push(required, rec(e).File))
    Object.values(rec(refs.Motions)).forEach((group) =>
      arr(group).forEach((m) => {
        push(required, rec(m).File)
        push(optional, rec(m).Sound)
      })
    )
  } else {
    if (!str(root.model)) throw new Error('The model.json has no "model" (.moc) entry.')
    if (arr(root.textures).length === 0) throw new Error('The model.json lists no textures.')
    push(required, root.model)
    arr(root.textures).forEach((t) => push(required, t))
    for (const key of ['physics', 'pose']) push(required, root[key])
    arr(root.expressions).forEach((e) => push(required, rec(e).file))
    Object.values(rec(root.motions)).forEach((group) =>
      arr(group).forEach((m) => {
        push(required, rec(m).file)
        push(optional, rec(m).sound)
      })
    )
  }
  return { required, optional: optional.filter((o) => !required.includes(o)) }
}

/**
 * Normalise a relative reference ("./a/../b.png", "a\\b.png") to POSIX form.
 * Returns null if it is absolute, a URL, or escapes the model directory.
 */
export function safeRelativePath(ref: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('/') || ref.startsWith('\\')) return null
  const parts: string[] = []
  for (const part of ref.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) return null
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  return parts.length > 0 ? parts.join('/') : null
}

/** URL served by the custom protocol for a file inside a model directory. */
export function modelFileUrl(source: ModelSource, dirName: string, relativePath: string): string {
  const path = [dirName, ...relativePath.split('/')].map(encodeURIComponent).join('/')
  return `${MODEL_PROTOCOL}://${source}/${path}`
}

/**
 * Parse a protocol URL back to (source, path segments). Returns null for
 * unknown hosts or any traversal attempt.
 */
export function parseModelFileUrl(
  url: string
): { source: ModelSource; dirName: string; relativePath: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${MODEL_PROTOCOL}:`) return null
  const source = parsed.hostname
  if (source !== 'user' && source !== 'bundled') return null
  let segments: string[]
  try {
    segments = parsed.pathname
      .split('/')
      .filter((s) => s.length > 0)
      .map((s) => decodeURIComponent(s))
  } catch {
    return null
  }
  if (segments.length < 2) return null
  if (segments.some((s) => s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
    return null
  }
  const [dirName, ...rest] = segments
  return { source, dirName, relativePath: rest.join('/') }
}
