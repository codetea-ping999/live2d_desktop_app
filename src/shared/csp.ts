import { MODEL_PROTOCOL } from './models'

/**
 * Content-Security-Policy for the renderer (#16).
 *
 * production: only the app's own files and the local model protocol.
 *   - no 'unsafe-eval' (Pixi uses @pixi/unsafe-eval's precompiled shaders)
 *   - 'wasm-unsafe-eval' lets Cubism Core 5 instantiate its WebAssembly
 *   - no remote origins at all: models come from live2d-model://
 * development: adds what Vite HMR / React Refresh need.
 */
export function buildCsp(mode: 'development' | 'production'): string {
  const model = `${MODEL_PROTOCOL}:`
  const dev = mode === 'development'
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': dev
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"]
      : ["'self'", "'wasm-unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', model],
    'media-src': ["'self'", 'blob:', model],
    'connect-src': dev ? ["'self'", model, 'ws:', 'http://localhost:*'] : ["'self'", model],
    'font-src': ["'self'", 'data:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"]
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}
