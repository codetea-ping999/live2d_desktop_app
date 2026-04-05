import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  clipboard,
  screen,
  session,
  dialog
} from 'electron'
import { basename, extname, join, normalize, sep } from 'path'
import { exec, execFile } from 'child_process'
import { cp, mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as si from 'systeminformation'
import { isSafeAppLaunchTarget, isSafeExternalUrl, isTrustedIpcEvent } from './security'

const SETTINGS_FILENAME = 'settings.json'
const MODEL_PROTOCOL = 'live2d-model'
const AUDIO_PROTOCOL = 'live2d-audio'
const DEFAULT_AUTO_FREE_THRESHOLD = 85
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11437'
const DEFAULT_OLLAMA_MODEL = 'gemma4:latest'

const MODEL_MIME: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.moc3': 'application/octet-stream',
  '.cdi3.json': 'application/json',
  '.motion3.json': 'application/json',
  '.physics3.json': 'application/json'
}

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac'
}

interface MusicTrack {
  id: string
  title: string
  fileName: string
}

interface SystemMetrics {
  cpu: number // CPU使用率 (0-100)
  memory: number // メモリ使用率 (0-100)
  disk: number // ディスク使用率 (0-100)
  network: {
    rx: number // 受信速度 (Mbps)
    tx: number // 送信速度 (Mbps)
  }
  timestamp: number
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function resolveOllamaBaseUrl(): string {
  const host = process.env.OLLAMA_HOST?.trim()
  const explicit = process.env.OLLAMA_BASE_URL?.trim()

  if (explicit) {
    return explicit.replace(/\/+$/, '')
  }

  if (host) {
    return `http://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
  }

  return DEFAULT_OLLAMA_BASE_URL
}

function resolveOllamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL
}

async function chatWithOllama(
  prompt: string,
  history: OllamaMessage[] = []
): Promise<{
  model: string
  baseUrl: string
  reply: string
}> {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error('Prompt is required')
  }

  const baseUrl = resolveOllamaBaseUrl()
  const model = resolveOllamaModel()
  const messages: OllamaMessage[] = [
    ...history
      .filter((item) => item && typeof item.content === 'string' && typeof item.role === 'string')
      .map((item) => ({
        role: item.role,
        content: item.content.trim()
      }))
      .filter((item) => item.content.length > 0),
    { role: 'user', content: trimmedPrompt }
  ]

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: {
        num_ctx: 8192
      }
    })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Ollama request failed (${response.status}): ${detail || response.statusText}`)
  }

  const data = (await response.json()) as {
    message?: { content?: string }
  }
  const reply = data.message?.content?.trim()
  if (!reply) {
    throw new Error('Ollama returned an empty response')
  }

  return { model, baseUrl, reply }
}

async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    const [currentLoad, mem, fsSize, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats()
    ])

    const cpuUsage = currentLoad.currentLoad || 0
    const memUsage = (mem.used / mem.total) * 100 || 0
    let diskUsage = 0

    if (fsSize.length > 0) {
      const mainDisk = fsSize[0]
      diskUsage = (mainDisk.used / mainDisk.size) * 100 || 0
    }

    let rxMbps = 0
    let txMbps = 0
    if (networkStats.length > 0) {
      const stats = networkStats[0]
      // rx_sec and tx_sec are in bytes/sec, convert to Mbps
      rxMbps = ((stats.rx_sec || 0) / 1_000_000) * 8
      txMbps = ((stats.tx_sec || 0) / 1_000_000) * 8
    }

    return {
      cpu: Math.round(cpuUsage * 100) / 100,
      memory: Math.round(memUsage * 100) / 100,
      disk: Math.round(diskUsage * 100) / 100,
      network: {
        rx: Math.round(rxMbps * 100) / 100,
        tx: Math.round(txMbps * 100) / 100
      },
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[SystemMetrics] Error getting metrics:', error)
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: { rx: 0, tx: 0 },
      timestamp: Date.now()
    }
  }
}

const gotTheLock = app.requestSingleInstanceLock()
const protocolName = 'live2d-desktop'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let pendingProtocolUrl: string | null = null

// Auto-free memory settings
let autoFreeEnabled = false
let autoFreeThreshold = DEFAULT_AUTO_FREE_THRESHOLD // percent
const autoFreeCooldownMs = 60_000 // 1 minute cooldown between auto frees
let lastAutoFreeAt = 0

function normalizeAutoFreeSettings(raw: Record<string, unknown>): void {
  autoFreeEnabled = typeof raw.autoFreeEnabled === 'boolean' ? raw.autoFreeEnabled : false
  autoFreeThreshold =
    typeof raw.autoFreeThreshold === 'number' && Number.isFinite(raw.autoFreeThreshold)
      ? Math.max(10, Math.min(95, Math.round(raw.autoFreeThreshold)))
      : DEFAULT_AUTO_FREE_THRESHOLD
}

async function freeMemory(): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'darwin') {
        // macOS: try purge (may require Xcode command line tools)
        exec('purge', (err, _stdout, stderr) => {
          if (err) {
            resolve({ success: false, message: stderr || err.message })
          } else {
            resolve({ success: true })
          }
        })
      } else if (process.platform === 'linux') {
        // Linux: dropping caches requires root; avoid executing by default
        resolve({ success: false, message: 'Not supported without elevated permissions on Linux' })
      } else if (process.platform === 'win32') {
        // Windows: not implemented here
        resolve({ success: false, message: 'Not implemented on Windows' })
      } else {
        resolve({ success: false, message: 'Platform not supported' })
      }
    } catch (e) {
      resolve({ success: false, message: String(e) })
    }
  })
}

function getModelsDirectory(): string {
  return join(app.getPath('userData'), 'models')
}

function getMusicDirectory(): string {
  return join(app.getPath('userData'), 'music')
}

async function ensureModelsDirectory(): Promise<string> {
  const directory = getModelsDirectory()
  if (!existsSync(directory)) await mkdir(directory, { recursive: true })
  return directory
}

async function ensureMusicDirectory(): Promise<string> {
  const directory = getMusicDirectory()
  if (!existsSync(directory)) await mkdir(directory, { recursive: true })
  return directory
}

function getCandidateModelsDirectories(): string[] {
  const candidates = [
    getModelsDirectory(),
    join(process.resourcesPath, 'models'),
    join(__dirname, '../renderer/models'),
    join(__dirname, '../../src/renderer/models')
  ]

  return [...new Set(candidates)].filter((path) => existsSync(path))
}

function getCandidateMusicDirectories(): string[] {
  const candidates = [getMusicDirectory(), join(process.resourcesPath, 'music')]
  return [...new Set(candidates)].filter((path) => existsSync(path))
}

function resolveModelFilePath(modelId: string): string | null {
  if (!modelId.trim()) return null

  for (const directory of getCandidateModelsDirectories()) {
    const runtimeDir = join(directory, modelId, 'runtime')
    const exactModelJsonPath = join(runtimeDir, `${modelId}.model3.json`)
    if (existsSync(exactModelJsonPath)) {
      return exactModelJsonPath
    }

    try {
      const fallbackModelJsonPath = readdirSync(runtimeDir, { withFileTypes: true }).find(
        (entry) => entry.isFile() && entry.name.endsWith('.model3.json')
      )
      if (fallbackModelJsonPath) {
        return join(runtimeDir, fallbackModelJsonPath.name)
      }
    } catch {
      // ignore missing runtime directories
    }
  }

  return null
}

function findModelJsonFileName(runtimeDir: string): string | null {
  try {
    const modelJsonEntry = readdirSync(runtimeDir, { withFileTypes: true }).find(
      (entry) => entry.isFile() && entry.name.endsWith('.model3.json')
    )
    return modelJsonEntry?.name ?? null
  } catch {
    return null
  }
}

function getModelEntryUrl(modelId: string): string | null {
  const modelFilePath = resolveModelFilePath(modelId)
  if (!modelFilePath) return null
  const modelFileName = basename(modelFilePath)
  return `${MODEL_PROTOCOL}://${encodeURIComponent(modelId)}/runtime/${encodeURIComponent(modelFileName)}`
}

function getAudioEntryUrl(trackId: string): string | null {
  const trackFilePath = resolveTrackFilePath(trackId)
  if (!trackFilePath) return null
  return `${AUDIO_PROTOCOL}:///${encodeURIComponent(trackId)}`
}

function resolveTrackFilePath(trackId: string): string | null {
  if (!trackId.trim()) return null

  for (const directory of getCandidateMusicDirectories()) {
    const candidate = join(directory, trackId)
    if (existsSync(candidate) && AUDIO_MIME[extname(candidate).toLowerCase()]) {
      return candidate
    }
  }

  return null
}

function inspectModelDirectory(sourceDirectory: string): {
  valid: boolean
  modelId?: string
  sourceRoot?: string
  message?: string
} {
  const directRuntimeDir = join(sourceDirectory, 'runtime')
  if (existsSync(directRuntimeDir)) {
    const modelJsonFileName = findModelJsonFileName(directRuntimeDir)
    if (!modelJsonFileName) {
      return { valid: false, message: 'runtime 配下に .model3.json が見つかりません。' }
    }

    return {
      valid: true,
      modelId: modelJsonFileName.replace(/\.model3\.json$/, ''),
      sourceRoot: sourceDirectory
    }
  }

  if (basename(sourceDirectory) === 'runtime') {
    const modelJsonFileName = findModelJsonFileName(sourceDirectory)
    if (!modelJsonFileName) {
      return {
        valid: false,
        message: '選択した runtime フォルダに .model3.json が見つかりません。'
      }
    }

    return {
      valid: true,
      modelId: modelJsonFileName.replace(/\.model3\.json$/, ''),
      sourceRoot: join(sourceDirectory, '..')
    }
  }

  return { valid: false, message: '選択したフォルダに runtime ディレクトリがありません。' }
}

function validateModelDirectory(sourceDirectory: string): {
  valid: boolean
  modelId?: string
  sourceRoot?: string
  message?: string
} {
  return inspectModelDirectory(sourceDirectory)
}

function resolveModelAssetPathFromUrl(rawUrl: string): string | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsedUrl.protocol !== `${MODEL_PROTOCOL}:`) {
    return null
  }

  const modelId = decodeURIComponent(parsedUrl.hostname)
  if (!modelId.trim()) {
    return null
  }

  const relativePath = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '')
  const normalizedRelativePath = normalize(relativePath)
  if (
    normalizedRelativePath.startsWith(`..${sep}`) ||
    normalizedRelativePath === '..' ||
    normalizedRelativePath.includes(`..${sep}`)
  ) {
    return null
  }

  const modelFilePath = resolveModelFilePath(modelId)
  if (!modelFilePath) {
    return null
  }

  const modelRoot = normalize(join(modelFilePath, '..', '..'))
  const absoluteAssetPath = normalize(join(modelRoot, normalizedRelativePath))
  if (!absoluteAssetPath.startsWith(modelRoot)) {
    return null
  }

  return absoluteAssetPath
}

function resolveAudioAssetPathFromUrl(rawUrl: string): string | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsedUrl.protocol !== `${AUDIO_PROTOCOL}:`) {
    return null
  }

  const trackId = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '').trim()
  if (!trackId) return null
  const normalizedTrackId = normalize(trackId)
  if (
    normalizedTrackId.startsWith(`..${sep}`) ||
    normalizedTrackId === '..' ||
    normalizedTrackId.includes(`..${sep}`)
  ) {
    return null
  }

  return resolveTrackFilePath(normalizedTrackId)
}

async function openModelsDirectory(): Promise<{ success: boolean; message?: string }> {
  const storagePath = await ensureModelsDirectory()
  const shellResult = await shell.openPath(storagePath)
  if (!shellResult) {
    return { success: true }
  }

  if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      execFile('open', [storagePath], (error) => {
        if (error) {
          resolve({ success: false, message: shellResult || error.message })
          return
        }
        resolve({ success: true })
      })
    })
  }

  return { success: false, message: shellResult }
}

async function openMusicDirectory(): Promise<{ success: boolean; message?: string }> {
  const storagePath = await ensureMusicDirectory()
  const shellResult = await shell.openPath(storagePath)
  if (!shellResult) {
    return { success: true }
  }

  if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      execFile('open', [storagePath], (error) => {
        if (error) {
          resolve({ success: false, message: shellResult || error.message })
          return
        }
        resolve({ success: true })
      })
    })
  }

  return { success: false, message: shellResult }
}

async function importModelDirectory(): Promise<{
  success: boolean
  modelId?: string
  message?: string
}> {
  const selected = await dialog.showOpenDialog({
    title: 'Live2D モデルフォルダを選択',
    properties: ['openDirectory']
  })

  if (selected.canceled || selected.filePaths.length === 0) {
    return { success: false, message: 'モデル取り込みをキャンセルしました。' }
  }

  const sourceDirectory = selected.filePaths[0]
  const validation = validateModelDirectory(sourceDirectory)
  if (!validation.valid || !validation.modelId || !validation.sourceRoot) {
    return { success: false, message: validation.message ?? 'モデルフォルダを確認できません。' }
  }

  const targetRoot = await ensureModelsDirectory()
  const targetDirectory = join(targetRoot, validation.modelId)
  if (existsSync(targetDirectory)) {
    return {
      success: false,
      message: `同名モデル "${validation.modelId}" が既に存在します。フォルダ名を変えて再試行してください。`
    }
  }

  await cp(validation.sourceRoot, targetDirectory, {
    recursive: true,
    errorOnExist: true,
    force: false
  })

  return {
    success: true,
    modelId: validation.modelId,
    message: `モデル "${validation.modelId}" を取り込みました。`
  }
}

function listModels(): string[] {
  const modelIds = new Set<string>()

  for (const directory of getCandidateModelsDirectories()) {
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          modelIds.add(entry.name)
        }
      }
    } catch {
      // ignore unreadable directories
    }
  }

  return [...modelIds].sort((a, b) => a.localeCompare(b))
}

function listMotions(modelId: string): string[] {
  const modelFilePath = resolveModelFilePath(modelId)
  if (!modelFilePath) return []

  const motionsDir = join(modelFilePath, '../motions')
  try {
    return readdirSync(motionsDir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.motion3.json'))
      .map((f) => f.name.replace(/\.motion3\.json$/, ''))
  } catch {
    return []
  }
}

function listTracks(): MusicTrack[] {
  const seen = new Set<string>()
  const tracks: MusicTrack[] = []

  for (const directory of getCandidateMusicDirectories()) {
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile()) continue
        const extension = extname(entry.name).toLowerCase()
        if (!AUDIO_MIME[extension] || seen.has(entry.name)) continue
        seen.add(entry.name)
        tracks.push({
          id: entry.name,
          title: entry.name.replace(/\.[^.]+$/, ''),
          fileName: entry.name
        })
      }
    } catch {
      // ignore unreadable directories
    }
  }

  return tracks.sort((left, right) => left.title.localeCompare(right.title))
}

function getUniqueTargetPath(directory: string, fileName: string): string {
  const extension = extname(fileName)
  const baseName = basename(fileName, extension)
  let nextPath = join(directory, fileName)
  let index = 1

  while (existsSync(nextPath)) {
    nextPath = join(directory, `${baseName}-${index}${extension}`)
    index += 1
  }

  return nextPath
}

async function importAudioFiles(): Promise<{
  success: boolean
  tracks?: MusicTrack[]
  message?: string
}> {
  const selected = await dialog.showOpenDialog({
    title: '音源ファイルを選択',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Audio',
        extensions: Object.keys(AUDIO_MIME).map((extension) => extension.replace('.', ''))
      }
    ]
  })

  if (selected.canceled || selected.filePaths.length === 0) {
    return { success: false, message: '音源の取り込みをキャンセルしました。' }
  }

  const targetRoot = await ensureMusicDirectory()
  const importedTracks: MusicTrack[] = []

  for (const sourcePath of selected.filePaths) {
    const extension = extname(sourcePath).toLowerCase()
    if (!AUDIO_MIME[extension]) continue

    const targetPath = getUniqueTargetPath(targetRoot, basename(sourcePath))
    await cp(sourcePath, targetPath, { force: false, errorOnExist: true })

    importedTracks.push({
      id: basename(targetPath),
      title: basename(targetPath, extension),
      fileName: basename(targetPath)
    })
  }

  if (importedTracks.length === 0) {
    return { success: false, message: '対応している音源ファイルが選択されていません。' }
  }

  return {
    success: true,
    tracks: importedTracks,
    message: `${importedTracks.length} 曲の音源を追加しました。`
  }
}

async function loadSettingsRaw(): Promise<Record<string, unknown>> {
  const userData = app.getPath('userData')
  if (!existsSync(userData)) await mkdir(userData, { recursive: true })
  const path = join(userData, SETTINGS_FILENAME)
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function saveSettingsRaw(data: Record<string, unknown>): Promise<void> {
  const userData = app.getPath('userData')
  if (!existsSync(userData)) await mkdir(userData, { recursive: true })
  const path = join(userData, SETTINGS_FILENAME)
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

async function syncRuntimeSettingsFromDisk(): Promise<void> {
  const raw = await loadSettingsRaw()
  normalizeAutoFreeSettings(raw)
}

async function persistModelAndNotify(modelId: string): Promise<void> {
  try {
    const raw = await loadSettingsRaw()
    raw.modelId = modelId || null
    await saveSettingsRaw(raw)
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('model:changed', modelId || null)
    }
  } catch (err) {
    console.error('persistModelAndNotify error', err)
  }
}

function buildTrayMenu(): void {
  if (!tray) return
  const models = listModels()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Models',
      submenu: models.map((m) => ({
        label: m,
        type: 'radio',
        click: () => {
          void persistModelAndNotify(m)
        }
      }))
    },
    {
      label: 'Show/Hide',
      click: (): void => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow?.show()
        }
      }
    },
    {
      label: 'Toggle Always on Top',
      type: 'checkbox',
      checked: mainWindow?.isAlwaysOnTop() ?? true,
      click: (menuItem): void => {
        mainWindow?.setAlwaysOnTop(menuItem.checked)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: (): void => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('Live2D Desktop')
  tray.setContextMenu(contextMenu)
}

function createWindow(): void {
  const workArea = screen.getPrimaryDisplay().workArea
  const width = Math.min(340, Math.max(260, Math.round(workArea.width * 0.18)))
  const height = Math.min(460, Math.max(320, Math.round(workArea.height * 0.42)))
  const x = Math.round(workArea.x + workArea.width - width - 20)
  const y = Math.round(workArea.y + workArea.height - height - 28)

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Renderer の console を main 側にフォワード（デバッグ用）
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    try {
      console.log(`[renderer][console:${level}] ${message} (${sourceId}:${line})`)
    } catch {
      // ignore
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingProtocolUrl) {
      mainWindow?.webContents.send('app:opened-url', pendingProtocolUrl)
      pendingProtocolUrl = null
    }
  })
}

function createTray(): void {
  tray = new Tray(nativeImage.createEmpty())
  buildTrayMenu()
}

function registerModelProtocol(): void {
  session.defaultSession.protocol.handle(MODEL_PROTOCOL, async (request) => {
    const assetPath = resolveModelAssetPathFromUrl(request.url)
    if (!assetPath || !existsSync(assetPath)) {
      return new Response('Not Found', { status: 404 })
    }

    try {
      const content = await readFile(assetPath)
      const mimeType = MODEL_MIME[extname(assetPath)] ?? 'application/octet-stream'
      return new Response(content, {
        status: 200,
        headers: {
          'content-type': mimeType,
          'cache-control': 'no-store'
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read model asset'
      return new Response(message, { status: 500 })
    }
  })
}

function registerAudioProtocol(): void {
  session.defaultSession.protocol.handle(AUDIO_PROTOCOL, async (request) => {
    const assetPath = resolveAudioAssetPathFromUrl(request.url)
    if (!assetPath || !existsSync(assetPath)) {
      return new Response('Not Found', { status: 404 })
    }

    try {
      const content = await readFile(assetPath)
      const mimeType = AUDIO_MIME[extname(assetPath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(content, {
        status: 200,
        headers: {
          'content-type': mimeType,
          'cache-control': 'no-store'
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read audio asset'
      return new Response(message, { status: 500 })
    }
  })
}

function setupIPC(): void {
  ipcMain.on('window:close', (event) => {
    if (!isTrustedIpcEvent(event)) return
    app.quit()
  })

  ipcMain.on('window:minimize', (event) => {
    if (!isTrustedIpcEvent(event)) return
    mainWindow?.minimize()
  })

  ipcMain.handle('window:toggle-always-on-top', (event) => {
    if (!isTrustedIpcEvent(event)) return false
    if (!mainWindow) return false
    const newValue = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(newValue)
    buildTrayMenu()
    return newValue
  })

  ipcMain.on('window:set-ignore-mouse', (event, ignore: boolean) => {
    if (!isTrustedIpcEvent(event)) return
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on('window:move', (event, x: number, y: number) => {
    if (!isTrustedIpcEvent(event)) return
    if (typeof x === 'number' && typeof y === 'number') {
      mainWindow?.setPosition(Math.round(x), Math.round(y))
    }
  })

  ipcMain.handle('window:get-bounds', (event) => {
    if (!isTrustedIpcEvent(event)) return null
    if (!mainWindow) return null
    return mainWindow.getBounds()
  })

  ipcMain.handle('settings:get', async (event) => {
    if (!isTrustedIpcEvent(event)) return null
    const raw = await loadSettingsRaw()
    return Object.keys(raw).length > 0 ? raw : null
  })

  ipcMain.handle('settings:set', async (event, data: Record<string, unknown>) => {
    if (!isTrustedIpcEvent(event)) return
    await saveSettingsRaw(data)
    normalizeAutoFreeSettings(data)
  })

  ipcMain.handle('shortcuts:copy-to-clipboard', (event, text: string) => {
    if (!isTrustedIpcEvent(event)) return
    if (typeof text === 'string') {
      clipboard.writeText(text)
    }
  })

  ipcMain.handle('shortcuts:launch-app', (event, appNameOrPath: string) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }

    return new Promise<void>((resolve, reject) => {
      if (!isSafeAppLaunchTarget(appNameOrPath)) {
        reject(new Error('App name or path is required'))
        return
      }
      const name = appNameOrPath.trim()
      if (process.platform === 'darwin') {
        execFile('open', ['-a', name], (err) => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        shell.openPath(name).then((errMsg) => {
          if (errMsg) reject(new Error(errMsg))
          else resolve()
        })
      }
    })
  })

  ipcMain.handle('model:set', async (event, modelId: string) => {
    if (!isTrustedIpcEvent(event)) return false
    try {
      await persistModelAndNotify(modelId)
      buildTrayMenu()
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('models:list', async (event) => {
    if (!isTrustedIpcEvent(event)) return []
    await ensureModelsDirectory()
    return listModels()
  })

  ipcMain.handle('models:get-entry', async (event, modelId: string) => {
    if (!isTrustedIpcEvent(event)) return null
    await ensureModelsDirectory()
    return getModelEntryUrl(modelId)
  })

  ipcMain.handle('models:get-storage-path', async (event) => {
    if (!isTrustedIpcEvent(event)) return ''
    return ensureModelsDirectory()
  })

  ipcMain.handle('models:open-storage-path', async (event) => {
    if (!isTrustedIpcEvent(event)) return false
    return openModelsDirectory()
  })

  ipcMain.handle('models:import-directory', async (event) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    const result = await importModelDirectory()
    if (result.success) {
      buildTrayMenu()
    }
    return result
  })

  ipcMain.handle('motions:list', (event, modelId: string) => {
    if (!isTrustedIpcEvent(event)) return []
    return listMotions(modelId)
  })

  ipcMain.handle('music:list', async (event) => {
    if (!isTrustedIpcEvent(event)) return []
    await ensureMusicDirectory()
    return listTracks()
  })

  ipcMain.handle('music:get-entry', async (event, trackId: string) => {
    if (!isTrustedIpcEvent(event)) return null
    await ensureMusicDirectory()
    return getAudioEntryUrl(trackId)
  })

  ipcMain.handle('music:get-storage-path', async (event) => {
    if (!isTrustedIpcEvent(event)) return ''
    return ensureMusicDirectory()
  })

  ipcMain.handle('music:open-storage-path', async (event) => {
    if (!isTrustedIpcEvent(event)) return false
    return openMusicDirectory()
  })

  ipcMain.handle('music:import-files', async (event) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    return importAudioFiles()
  })

  ipcMain.handle('ollama:chat', async (event, prompt: string, history?: OllamaMessage[]) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    return await chatWithOllama(prompt, history)
  })

  ipcMain.handle('ollama:status', async (event) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }

    const baseUrl = resolveOllamaBaseUrl()
    const model = resolveOllamaModel()
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) {
      throw new Error(`Ollama status check failed (${response.status})`)
    }

    const data = (await response.json()) as { models?: Array<{ name?: string }> }
    const availableModels = Array.isArray(data.models)
      ? data.models.map((item) => item.name).filter((name): name is string => Boolean(name))
      : []

    return {
      baseUrl,
      model,
      availableModels,
      modelAvailable: availableModels.includes(model)
    }
  })

  // Renderer -> Main console forward receiver
  ipcMain.on('renderer:console', (event, payload: { level: string; args: unknown[] }) => {
    if (!isTrustedIpcEvent(event)) return
    try {
      const { level, args } = payload || { level: 'log', args: [] }
      const text = args
        .map((a) => {
          try {
            return typeof a === 'string' ? a : JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' ')
      console.log(`[renderer][${level}] ${text}`)
    } catch {
      // ignore
    }
  })

  // System Metrics IPC
  ipcMain.handle('system:metrics', async (event) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    return await getSystemMetrics()
  })

  // Free memory on demand
  ipcMain.handle('system:free-memory', async (event) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    const result = await freeMemory()
    return result
  })

  // Auto-free controls
  ipcMain.handle('system:set-auto-free', (event, enabled: boolean, threshold?: number) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    autoFreeEnabled = Boolean(enabled)
    if (typeof threshold === 'number' && !Number.isNaN(threshold)) {
      autoFreeThreshold = Math.max(10, Math.min(95, Math.round(threshold)))
    }
    void (async () => {
      const raw = await loadSettingsRaw()
      raw.autoFreeEnabled = autoFreeEnabled
      raw.autoFreeThreshold = autoFreeThreshold
      await saveSettingsRaw(raw)
    })().catch((error) => {
      console.error('[system:set-auto-free] Failed to persist settings:', error)
    })
    return { enabled: autoFreeEnabled, threshold: autoFreeThreshold }
  })

  ipcMain.handle('system:get-auto-free', (event) => {
    if (!isTrustedIpcEvent(event)) {
      throw new Error('Untrusted renderer')
    }
    return { enabled: autoFreeEnabled, threshold: autoFreeThreshold }
  })

  // Periodic auto-free checker (lightweight)
  setInterval(async () => {
    try {
      if (!autoFreeEnabled) return
      const now = Date.now()
      if (now - lastAutoFreeAt < autoFreeCooldownMs) return
      const metrics = await getSystemMetrics()
      if (metrics.memory >= autoFreeThreshold) {
        const res = await freeMemory()
        lastAutoFreeAt = Date.now()
        if (mainWindow?.webContents) {
          mainWindow.webContents.send('system:auto-free-performed', { result: res, metrics })
        }
      }
    } catch {
      // ignore
    }
  }, 5000)

  // Renderer requests to start metrics monitoring
  ipcMain.handle('system:start-monitoring', (event) => {
    if (!isTrustedIpcEvent(event)) return false
    // Renderer will call metrics handle periodically
    return true
  })
}

function focusMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function deliverProtocolUrl(url: string): void {
  pendingProtocolUrl = url
  focusMainWindow()
  if (mainWindow?.webContents.isLoadingMainFrame()) return
  mainWindow?.webContents.send('app:opened-url', url)
  pendingProtocolUrl = null
}

function extractProtocolUrl(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${protocolName}://`)) ?? null
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.live2d.desktop')

  if (!gotTheLock) {
    app.quit()
    return
  }

  if (!is.dev) {
    app.setAsDefaultProtocolClient(protocolName)
  }

  registerModelProtocol()
  registerAudioProtocol()
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  app.on('second-instance', (_event, argv) => {
    const protocolUrl = extractProtocolUrl(argv)
    if (protocolUrl) {
      deliverProtocolUrl(protocolUrl)
      return
    }

    focusMainWindow()
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    deliverProtocolUrl(url)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await ensureModelsDirectory()
  await ensureMusicDirectory()
  await syncRuntimeSettingsFromDisk()
  setupIPC()
  createWindow()
  createTray()

  const initialProtocolUrl = extractProtocolUrl(process.argv)
  if (initialProtocolUrl) {
    deliverProtocolUrl(initialProtocolUrl)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
