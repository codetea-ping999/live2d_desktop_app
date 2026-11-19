import { describe, expect, it } from 'vitest'
import { buildCsp } from './csp'

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split(';').map((d) => {
      const [name, ...values] = d.trim().split(/\s+/)
      return [name, values]
    })
  )
}

describe('buildCsp (#16)', () => {
  it('production has no unsafe-eval, no inline scripts and no remote origins', () => {
    const csp = buildCsp('production')
    const d = directives(csp)
    expect(d['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"])
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toMatch(/https?:/)
    expect(d['connect-src']).toEqual(["'self'", 'live2d-model:'])
    expect(d['object-src']).toEqual(["'none'"])
  })

  it('development adds only what Vite HMR needs', () => {
    const d = directives(buildCsp('development'))
    expect(d['script-src']).toContain("'unsafe-inline'")
    expect(d['connect-src']).toContain('ws:')
  })
})
