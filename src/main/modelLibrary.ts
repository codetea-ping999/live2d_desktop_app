import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import { basename, dirname, join, relative, resolve, sep } from 'path'
import {
  collectReferencedFiles,
  entryVersion,
  modelFileUrl,
  modelId,
  parseModelFileUrl,
  pickEntry,
  safeRelativePath,
  slugify,
  uniqueSlug,
  type CubismVersion,
  type ModelMetadata,
  type ModelSource,
  type ModelSummary
} from '../shared/models'

const METADATA_FILE = 'metadata.json'
const SEARCH_DEPTH = 3
const MAX_SCANNED_ENTRIES = 2000

export class ModelImportError extends Error {}

interface ResolvedModel {
  summary: ModelSummary
  dirName: string
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isFile()
  } catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** True if `child` is inside `parent` (after resolving `..`). */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel)
}

/** Find entry JSON candidates below `dir` (relative POSIX paths). */
async function findEntryCandidates(dir: string): Promise<string[]> {
  const found: string[] = []
  let scanned = 0
  const walk = async (current: string, depth: number): Promise<void> => {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (++scanned > MAX_SCANNED_ENTRIES) return
      if (entry.name.startsWith('.')) continue
      const full = join(current, entry.name)
      if (entry.isFile() && entryVersion(entry.name) !== null) {
        found.push(relative(dir, full).split(sep).join('/'))
      } else if (entry.isDirectory() && depth < SEARCH_DEPTH) {
        await walk(full, depth + 1)
      }
    }
  }
  await walk(dir, 0)
  return found
}

export interface ValidatedModel {
  /** Directory everything is relative to (the entry's folder). */
  root: string
  entry: string
  version: CubismVersion
  /** Files to copy (relative to root), entry first. */
  files: string[]
  name: string
}

/**
 * Validate a model on disk: parse its entry and check every referenced file
 * exists inside the model directory. Throws ModelImportError with a message
 * meant for the user.
 */
export async function validateModel(entryPath: string): Promise<ValidatedModel> {
  const root = dirname(entryPath)
  const entry = basename(entryPath)
  const version = entryVersion(entry)
  if (version === null) {
    throw new ModelImportError(
      `"${entry}" is not a Live2D model file. Choose a *.model3.json (Cubism 4) or model.json (Cubism 2).`
    )
  }
  let json: unknown
  try {
    json = JSON.parse(await fs.readFile(entryPath, 'utf8'))
  } catch {
    throw new ModelImportError(`Could not read "${entry}" as JSON.`)
  }
  let refs: ReturnType<typeof collectReferencedFiles>
  try {
    refs = collectReferencedFiles(json, version)
  } catch (error) {
    throw new ModelImportError((error as Error).message)
  }

  const files = [entry]
  const missing: string[] = []
  for (const ref of refs.required) {
    const rel = safeRelativePath(ref)
    if (!rel) throw new ModelImportError(`"${ref}" points outside the model folder.`)
    if (!(await isFile(join(root, rel)))) missing.push(rel)
    else if (!files.includes(rel)) files.push(rel)
  }
  if (missing.length > 0) {
    const shown = missing.slice(0, 5).join(', ')
    const more = missing.length > 5 ? ` and ${missing.length - 5} more` : ''
    throw new ModelImportError(`Missing files referenced by ${entry}: ${shown}${more}.`)
  }
  for (const ref of refs.optional) {
    const rel = safeRelativePath(ref)
    if (rel && !files.includes(rel) && (await isFile(join(root, rel)))) files.push(rel)
  }

  const fileBase = entry.replace(/(\.model3)?\.json$/i, '').replace(/^model$/i, '')
  const name = fileBase || basename(root) || 'Live2D model'
  return { root, entry, version, files, name }
}

/** Resolve what the user picked (folder or entry file) to an entry path. */
export async function locateEntry(picked: string): Promise<string> {
  if (await isFile(picked)) return picked
  if (!(await isDirectory(picked))) throw new ModelImportError('The selected path does not exist.')
  const choice = pickEntry(await findEntryCandidates(picked))
  if (!choice) {
    throw new ModelImportError(
      'No Live2D model found in this folder (looked for *.model3.json and model.json).'
    )
  }
  return join(picked, ...choice.entry.split('/'))
}

export interface ModelLibraryOptions {
  userRoot: string
  bundledRoot: string | null
}

export class ModelLibrary {
  private readonly roots: Record<ModelSource, string | null>

  constructor(options: ModelLibraryOptions) {
    this.roots = { user: options.userRoot, bundled: options.bundledRoot }
  }

  get userRoot(): string {
    return this.roots.user!
  }

  /** All usable models: user library first, then bundled ones. */
  async list(): Promise<ModelSummary[]> {
    const user = await this.scan('user')
    const bundled = await this.scan('bundled')
    return [...user, ...bundled].map((m) => m.summary)
  }

  private async scan(source: ModelSource): Promise<ResolvedModel[]> {
    const root = this.roots[source]
    if (!root) return []
    let dirs: import('fs').Dirent[]
    try {
      dirs = await fs.readdir(root, { withFileTypes: true })
    } catch {
      return []
    }
    const result: ResolvedModel[] = []
    const slugs = new Set<string>()
    for (const dir of dirs.filter((d) => d.isDirectory() && !d.name.startsWith('.'))) {
      const resolved = await this.resolveDir(source, root, dir.name, slugs)
      if (resolved) {
        slugs.add(resolved.summary.id.split(':')[1])
        result.push(resolved)
      }
    }
    return result.sort((a, b) => a.summary.name.localeCompare(b.summary.name))
  }

  private async resolveDir(
    source: ModelSource,
    root: string,
    dirName: string,
    taken: Set<string>
  ): Promise<ResolvedModel | null> {
    const dir = join(root, dirName)
    let entry: string | null = null
    let version: CubismVersion | null = null
    let name = dirName

    const meta = await readMetadata(dir)
    if (meta) {
      const rel = safeRelativePath(meta.entry)
      if (rel && (await isFile(join(dir, rel)))) {
        entry = rel
        version = meta.cubismVersion
        name = meta.name
      }
    }
    if (!entry) {
      const choice = pickEntry(await findEntryCandidates(dir))
      if (!choice) return null
      entry = choice.entry
      version = choice.version
    }
    const slug = source === 'user' ? slugify(dirName) : uniqueSlug(dirName, taken)
    return {
      dirName,
      summary: {
        id: modelId(source, slug),
        name,
        source,
        cubismVersion: version!,
        url: modelFileUrl(source, dirName, entry)
      }
    }
  }

  /**
   * Copy a validated model into the user library. Work happens in a hidden
   * temp folder that is renamed into place at the end, so a failure never
   * leaves a half-imported model behind.
   */
  async import(picked: string): Promise<ModelSummary> {
    const entryPath = await locateEntry(picked)
    const model = await validateModel(entryPath)
    await fs.mkdir(this.userRoot, { recursive: true })

    const existing = (await fs.readdir(this.userRoot)).filter((n) => !n.startsWith('.'))
    const displayName = basename(model.root) || model.name
    const slug = uniqueSlug(displayName, existing)
    const tmp = join(this.userRoot, `.import-${randomBytes(6).toString('hex')}`)
    const target = join(this.userRoot, slug)

    try {
      for (const file of model.files) {
        const from = join(model.root, ...file.split('/'))
        const to = join(tmp, ...file.split('/'))
        await fs.mkdir(dirname(to), { recursive: true })
        await fs.copyFile(from, to)
      }
      const metadata: ModelMetadata = {
        schema: 1,
        name: displayName,
        entry: model.entry,
        cubismVersion: model.version,
        importedAt: new Date().toISOString()
      }
      await fs.writeFile(join(tmp, METADATA_FILE), JSON.stringify(metadata, null, 2))
      await fs.rename(tmp, target)
    } catch (error) {
      await fs.rm(tmp, { recursive: true, force: true })
      throw new ModelImportError(`Import failed while copying files: ${(error as Error).message}`)
    }

    const summary = (await this.list()).find((m) => m.id === modelId('user', slug))
    if (!summary) throw new ModelImportError('Imported model could not be listed.')
    return summary
  }

  /**
   * Map a protocol URL to a file on disk, or null if it is not a file inside
   * one of the library roots.
   */
  resolveFileUrl(url: string): string | null {
    const parsed = parseModelFileUrl(url)
    if (!parsed) return null
    const root = this.roots[parsed.source]
    if (!root) return null
    const rel = safeRelativePath(`${parsed.dirName}/${parsed.relativePath}`)
    if (!rel) return null
    const full = join(root, ...rel.split('/'))
    return isInside(root, full) ? full : null
  }
}

async function readMetadata(dir: string): Promise<ModelMetadata | null> {
  try {
    const raw = JSON.parse(await fs.readFile(join(dir, METADATA_FILE), 'utf8'))
    if (
      raw &&
      raw.schema === 1 &&
      typeof raw.name === 'string' &&
      typeof raw.entry === 'string' &&
      (raw.cubismVersion === 2 || raw.cubismVersion === 4)
    ) {
      return raw as ModelMetadata
    }
  } catch {
    // no / invalid metadata: fall back to detection
  }
  return null
}
