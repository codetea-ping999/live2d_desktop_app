import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { buildCsp } from './src/shared/csp'

/** Inject the dev or production CSP into index.html (#16). */
function cspPlugin(): Plugin {
  let mode: 'development' | 'production' = 'production'
  return {
    name: 'live2d-csp',
    configResolved(config) {
      mode = config.command === 'serve' ? 'development' : 'production'
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(mode) },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), cspPlugin()]
  }
})
