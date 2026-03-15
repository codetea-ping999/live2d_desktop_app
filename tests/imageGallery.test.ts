import test from 'node:test'
import assert from 'node:assert/strict'
import { toDownloadFileName } from '../src/renderer/src/gallery/imageDownload'

test('gallery downloads infer a jpg extension from jpeg data urls', () => {
  assert.equal(
    toDownloadFileName('Portrait Sample', 'data:image/jpeg;base64,abc'),
    'Portrait-Sample.jpg'
  )
})

test('gallery downloads sanitize invalid filename characters', () => {
  assert.equal(toDownloadFileName('bad:/\\name*?', 'data:image/png;base64,abc'), 'bad-name.png')
})

test('gallery downloads fall back to png when the source is not a data url', () => {
  assert.equal(toDownloadFileName('Remote Asset', 'https://example.com/image'), 'Remote-Asset.png')
})
