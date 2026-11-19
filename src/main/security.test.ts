import { describe, expect, it } from 'vitest'
import { isAppUrl, isSafeExternalUrl } from './security'

describe('isSafeExternalUrl (#16)', () => {
  it('allows plain https links only', () => {
    expect(isSafeExternalUrl('https://www.live2d.com/en/sdk/download/web/')).toBe(true)
    for (const bad of [
      'http://example.com',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'smb://host/share',
      'ms-msdt:/id',
      'https://user:pass@example.com',
      'not a url',
      ''
    ]) {
      expect(isSafeExternalUrl(bad)).toBe(false)
    }
  })
})

describe('isAppUrl (#16)', () => {
  const prod = { rendererFileUrl: 'file:///Applications/Live2D.app/out/renderer/index.html' }
  const dev = { ...prod, devServerUrl: 'http://localhost:5173' }

  it('accepts only the packaged renderer page in production', () => {
    expect(isAppUrl('file:///Applications/Live2D.app/out/renderer/index.html', prod)).toBe(true)
    expect(isAppUrl('file:///Applications/Live2D.app/out/renderer/index.html#x', prod)).toBe(true)
    expect(isAppUrl('file:///tmp/evil.html', prod)).toBe(false)
    expect(isAppUrl('http://localhost:5173/', prod)).toBe(false)
    expect(isAppUrl('https://evil.example', prod)).toBe(false)
    expect(isAppUrl(null, prod)).toBe(false)
  })

  it('also accepts the dev server origin in development', () => {
    expect(isAppUrl('http://localhost:5173/', dev)).toBe(true)
    expect(isAppUrl('http://localhost:5174/', dev)).toBe(false)
  })
})
