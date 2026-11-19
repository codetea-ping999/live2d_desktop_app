import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  writeCubism2Model,
  writeCubism4Model,
  writeFixtureFile
} from '../../test/helpers/modelFixtures'
import { ModelImportError, ModelLibrary, validateModel } from './modelLibrary'
import { promises as fsp } from 'fs'

let tmp: string
let library: ModelLibrary
let userRoot: string
let bundledRoot: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'live2d-lib-'))
  userRoot = join(tmp, 'userData', 'models')
  bundledRoot = join(tmp, 'bundled')
  library = new ModelLibrary({ userRoot, bundledRoot })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('ModelLibrary.list (#9)', () => {
  it('is empty when nothing is installed', async () => {
    expect(await library.list()).toEqual([])
  })

  it('lists bundled models without metadata, with protocol URLs', async () => {
    writeCubism2Model(join(bundledRoot, 'Hatsune Miku'))
    writeCubism4Model(join(bundledRoot, 'haru', 'runtime'))
    const models = await library.list()
    expect(models).toEqual([
      {
        id: 'bundled:haru',
        name: 'haru',
        source: 'bundled',
        cubismVersion: 4,
        url: 'live2d-model://bundled/haru/runtime/Haru.model3.json'
      },
      {
        id: 'bundled:hatsune-miku',
        name: 'Hatsune Miku',
        source: 'bundled',
        cubismVersion: 2,
        url: 'live2d-model://bundled/Hatsune%20Miku/model.json'
      }
    ])
  })

  it('skips folders without a model', async () => {
    writeFixtureFile(join(bundledRoot, 'notes', 'readme.txt'))
    expect(await library.list()).toEqual([])
  })
})

describe('ModelLibrary.import (#10)', () => {
  it('imports a Cubism 4 folder, copying only referenced files', async () => {
    writeCubism4Model(join(tmp, 'src', 'Haru'))
    const model = await library.import(join(tmp, 'src', 'Haru'))
    expect(model).toMatchObject({ id: 'user:haru', source: 'user', cubismVersion: 4, name: 'Haru' })
    const dir = join(userRoot, 'haru')
    expect(existsSync(join(dir, 'Haru.model3.json'))).toBe(true)
    expect(existsSync(join(dir, 'textures', 'texture_00.png'))).toBe(true)
    expect(existsSync(join(dir, 'metadata.json'))).toBe(true)
    expect(existsSync(join(dir, 'unrelated-big-file.psd'))).toBe(false)
    // listed immediately
    expect((await library.list()).map((m) => m.id)).toEqual(['user:haru'])
  })

  it('imports when the entry JSON itself is picked (Cubism 2)', async () => {
    const entry = writeCubism2Model(join(tmp, 'src', 'miku'))
    const model = await library.import(entry)
    expect(model).toMatchObject({ id: 'user:miku', cubismVersion: 2 })
    expect(model.url).toBe('live2d-model://user/miku/model.json')
  })

  it('gives duplicates a unique ID instead of overwriting', async () => {
    writeCubism4Model(join(tmp, 'a', 'Haru'))
    writeCubism4Model(join(tmp, 'b', 'Haru'))
    const first = await library.import(join(tmp, 'a', 'Haru'))
    const second = await library.import(join(tmp, 'b', 'Haru'))
    expect([first.id, second.id]).toEqual(['user:haru', 'user:haru-2'])
  })

  it('fails clearly when a referenced file is missing and leaves no partial folder', async () => {
    const entry = writeCubism4Model(join(tmp, 'src', 'Broken'))
    rmSync(join(tmp, 'src', 'Broken', 'textures', 'texture_00.png'))
    await expect(library.import(entry)).rejects.toThrow(
      /Missing files referenced by Haru\.model3\.json: textures\/texture_00\.png/
    )
    expect(existsSync(userRoot) ? readdirSync(userRoot) : []).toEqual([])
  })

  it('rejects folders without a model and non-model files', async () => {
    writeFixtureFile(join(tmp, 'empty', 'a.txt'))
    await expect(library.import(join(tmp, 'empty'))).rejects.toThrow(/No Live2D model found/)
    await expect(library.import(join(tmp, 'empty', 'a.txt'))).rejects.toBeInstanceOf(
      ModelImportError
    )
  })

  it('rejects references that escape the model folder', async () => {
    const entry = join(tmp, 'evil', 'model.json')
    writeFixtureFile(entry, { model: '../../secret.moc', textures: ['t.png'] })
    await expect(validateModel(entry)).rejects.toThrow(/outside the model folder/)
  })

  it('cleans up the temp folder if copying fails midway', async () => {
    writeCubism4Model(join(tmp, 'src', 'Haru'))
    const realCopy = fsp.copyFile
    let calls = 0
    const spy = vi.spyOn(fsp, 'copyFile').mockImplementation(async (from, to, mode) => {
      if (++calls === 3) throw new Error('disk full')
      return realCopy(from, to, mode)
    })
    await expect(library.import(join(tmp, 'src', 'Haru'))).rejects.toThrow(/disk full/)
    spy.mockRestore()
    expect(readdirSync(userRoot)).toEqual([])
  })
})

describe('ModelLibrary.resolveFileUrl', () => {
  it('maps protocol URLs to files inside the roots only', async () => {
    writeCubism2Model(join(bundledRoot, 'miku'))
    expect(library.resolveFileUrl('live2d-model://bundled/miku/model.json')).toBe(
      join(bundledRoot, 'miku', 'model.json')
    )
    expect(library.resolveFileUrl('live2d-model://bundled/miku/%2e%2e/%2e%2e/x')).toBeNull()
    expect(library.resolveFileUrl('live2d-model://user/..%2f..%2fetc/passwd')).toBeNull()
    expect(library.resolveFileUrl('https://example.com/model.json')).toBeNull()
  })
})
