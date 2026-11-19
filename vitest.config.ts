import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Fast, deterministic unit tests: no Electron window, no network, no real
// Live2D assets. Electron / Pixi / Live2D are replaced by mocks in test/helpers.
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    testTimeout: 5000
  }
})
