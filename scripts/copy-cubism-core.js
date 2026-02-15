#!/usr/bin/env node
/**
 * Cubism SDK for Web の live2dcubismcore.min.js を
 * プロジェクトの src/renderer/public/lib/ にコピーするスクリプト。
 *
 * 使い方:
 *   npm run copy-sdk
 *
 * 環境変数 LIVE2D_SDK_PATH で SDK のルートフォルダを指定可能。
 * 未指定の場合はプロジェクトの「一つ上の階層」の CubismSdkForWeb-5-r.4 を使用。
 * 例: Documents/live2d_desktop_app がプロジェクトなら、
 *     Documents/CubismSdkForWeb-5-r.4 がデフォルトの参照先。
 */

const { copyFileSync, existsSync, mkdirSync } = require('fs')
const { resolve } = require('path')

const projectRoot = resolve(__dirname, '..')
const defaultSdkPath = resolve(projectRoot, '..', 'CubismSdkForWeb-5-r.4')
const sdkRoot = process.env.LIVE2D_SDK_PATH
  ? resolve(process.env.LIVE2D_SDK_PATH)
  : defaultSdkPath

const sourceFile = resolve(sdkRoot, 'Core', 'live2dcubismcore.min.js')
const destDir = resolve(projectRoot, 'src', 'renderer', 'public', 'lib')
const destFile = resolve(destDir, 'live2dcubismcore.min.js')

if (!existsSync(sourceFile)) {
  console.error('Error: Cubism SDK core file not found.')
  console.error('  Looked at:', sourceFile)
  if (!process.env.LIVE2D_SDK_PATH) {
    console.error('  Default path is one level up: ../CubismSdkForWeb-5-r.4')
    console.error('  Or set LIVE2D_SDK_PATH to your SDK root folder.')
  }
  process.exit(1)
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true })
}

copyFileSync(sourceFile, destFile)
console.log('Copied Cubism SDK core to:', destFile)
