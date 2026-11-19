import { describe, expect, it } from 'vitest'
import {
  collectReferencedFiles,
  modelFileUrl,
  parseModelFileUrl,
  pickEntry,
  safeRelativePath,
  slugify,
  uniqueSlug
} from './models'

describe('model library rules (#9)', () => {
  it('detects the entry: Cubism 4 first, then shallowest', () => {
    expect(pickEntry(['a/model.json', 'b/c/Haru.model3.json', 'readme.txt'])).toEqual({
      entry: 'b/c/Haru.model3.json',
      version: 4
    })
    expect(pickEntry(['deep/x/model.json', 'model.json'])).toEqual({
      entry: 'model.json',
      version: 2
    })
    expect(pickEntry(['physics.json', 'a.png'])).toBeNull()
  })

  it('builds stable, unique, filesystem-safe IDs', () => {
    expect(slugify('Hatsune Miku (v2)')).toBe('hatsune-miku-v2')
    expect(slugify('初音ミク')).toBe('model')
    expect(slugify('../../etc')).toBe('etc')
    expect(uniqueSlug('Miku', ['miku', 'miku-2'])).toBe('miku-3')
  })

  it('collects files referenced by Cubism 4 and Cubism 2 entries', () => {
    expect(
      collectReferencedFiles(
        {
          FileReferences: {
            Moc: 'a.moc3',
            Textures: ['t/0.png', 't/1.png'],
            Physics: 'a.physics3.json',
            Motions: { Idle: [{ File: 'm/idle.motion3.json', Sound: 's/a.wav' }] }
          }
        },
        4
      )
    ).toEqual({
      required: ['a.moc3', 't/0.png', 't/1.png', 'a.physics3.json', 'm/idle.motion3.json'],
      optional: ['s/a.wav']
    })
    expect(
      collectReferencedFiles(
        { model: 'm.moc', textures: ['t.png'], expressions: [{ name: 'f', file: 'e.json' }] },
        2
      )
    ).toEqual({ required: ['m.moc', 't.png', 'e.json'], optional: [] })
  })

  it('rejects entries without moc or textures', () => {
    expect(() => collectReferencedFiles({ FileReferences: { Textures: ['a'] } }, 4)).toThrow(/Moc/)
    expect(() => collectReferencedFiles({ model: 'm.moc', textures: [] }, 2)).toThrow(/textures/)
  })

  it('normalises references and refuses ones that escape the folder', () => {
    expect(safeRelativePath('./a/../b\\c.png')).toBe('b/c.png')
    expect(safeRelativePath('../secret')).toBeNull()
    expect(safeRelativePath('/etc/passwd')).toBeNull()
    expect(safeRelativePath('C:\\x.png')).toBeNull()
    expect(safeRelativePath('https://evil/x.png')).toBeNull()
  })

  it('round-trips protocol URLs and rejects traversal', () => {
    const url = modelFileUrl('bundled', 'Hatsune Miku', 'runtime/miku.model3.json')
    expect(url).toBe('live2d-model://bundled/Hatsune%20Miku/runtime/miku.model3.json')
    expect(parseModelFileUrl(url)).toEqual({
      source: 'bundled',
      dirName: 'Hatsune Miku',
      relativePath: 'runtime/miku.model3.json'
    })
    expect(parseModelFileUrl('live2d-model://user/a/%2e%2e/%2e%2e/x')).toBeNull()
    expect(parseModelFileUrl('live2d-model://user/a%2F..%2F..%2Fx/y')).toBeNull()
    expect(parseModelFileUrl('live2d-model://other/a/b')).toBeNull()
    expect(parseModelFileUrl('file:///etc/passwd')).toBeNull()
  })
})
