import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

function write(path: string, content: string | object = 'x'): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content))
}

/** A minimal Cubism 4 model folder (files are placeholders). */
export function writeCubism4Model(dir: string, name = 'Haru'): string {
  const entry = join(dir, `${name}.model3.json`)
  write(entry, {
    Version: 3,
    FileReferences: {
      Moc: `${name}.moc3`,
      Textures: ['textures/texture_00.png'],
      Physics: `${name}.physics3.json`,
      Expressions: [{ Name: 'smile', File: 'expressions/smile.exp3.json' }],
      Motions: {
        Idle: [{ File: 'motions/idle.motion3.json', Sound: 'sounds/missing.wav' }],
        TapBody: [{ File: 'motions/tap.motion3.json' }]
      }
    }
  })
  for (const f of [
    `${name}.moc3`,
    'textures/texture_00.png',
    `${name}.physics3.json`,
    'expressions/smile.exp3.json',
    'motions/idle.motion3.json',
    'motions/tap.motion3.json'
  ]) {
    write(join(dir, f))
  }
  write(join(dir, 'unrelated-big-file.psd'))
  return entry
}

/** A minimal Cubism 2 model folder. */
export function writeCubism2Model(dir: string): string {
  const entry = join(dir, 'model.json')
  write(entry, {
    model: 'miku.moc',
    textures: ['miku.1024/texture_00.png'],
    motions: { idle: [{ file: 'mtn/idle.mtn' }] }
  })
  for (const f of ['miku.moc', 'miku.1024/texture_00.png', 'mtn/idle.mtn']) write(join(dir, f))
  return entry
}

export { write as writeFixtureFile }
