import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs'

const projectRoot = process.cwd()

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.moc3': 'application/octet-stream',
  '.physics3.json': 'application/json',
  '.cdi3.json': 'application/json',
  '.motion3.json': 'application/json'
}

/** 開発時に /models で src/renderer/models を配信（sirv なし・Node 標準のみ） */
function serveModelsPlugin(): import('vite').Plugin {
  return {
    name: 'serve-models',
    configureServer(server) {
      const modelsDir = resolve(projectRoot, 'src/renderer/models')
      if (!existsSync(modelsDir)) return
      server.middlewares.use('/models', (req, res, next) => {
        const url = req.url ?? '/'
        const pathname = url.replace(/\?.*$/, '').replace(/^\//, '')
        const filePath = resolve(modelsDir, pathname)
        if (!filePath.startsWith(resolve(modelsDir))) return next()
        if (!existsSync(filePath)) return next()
        const stat = statSync(filePath)
        if (stat.isDirectory()) return next()
        const ext = pathname.includes('.') ? pathname.slice(pathname.lastIndexOf('.')) : ''
        const mime = MIME[ext] ?? 'application/octet-stream'
        res.setHeader('Content-Type', mime)
        createReadStream(filePath).pipe(res)
      })
    }
  }
}

/** ビルド時に models を output にコピーするプラグイン */
function copyModelsPlugin(): import('vite').Plugin {
  return {
    name: 'copy-models',
    closeBundle() {
      const modelsDir = resolve(projectRoot, 'src/renderer/models')
      const outDir = resolve(projectRoot, 'out/renderer')
      if (!existsSync(modelsDir)) return
      const dest = resolve(outDir, 'models')
      if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
      function copyRecursive(src: string, destDir: string) {
        readdirSync(src).forEach((name) => {
          const srcPath = resolve(src, name)
          const destPath = resolve(destDir, name)
          if (statSync(srcPath).isDirectory()) {
            if (!existsSync(destPath)) mkdirSync(destPath, { recursive: true })
            copyRecursive(srcPath, destPath)
          } else {
            copyFileSync(srcPath, destPath)
          }
        })
      }
      copyRecursive(modelsDir, dest)
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
    plugins: [react(), serveModelsPlugin(), copyModelsPlugin()]
  }
})
