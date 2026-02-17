import { app, shell, BrowserWindow, ipcMain, Menu, Tray, nativeImage, clipboard } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

const SETTINGS_FILENAME = 'settings.json'

const gotTheLock = app.requestSingleInstanceLock()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function getModelsDirectory(): string {
  // 開発時: __dirname = out/main, so ../renderer/models = out/renderer/models
  // 本番時: same as above
  const builtPath = join(__dirname, '../renderer/models')
  if (existsSync(builtPath)) {
    console.log(`[Models] Using built path: ${builtPath}`)
    return builtPath
  }

  // フォールバック: プロジェクトルート相対
  // electron-vite では src レイアウトから ../renderer/ をビルド
  const alternativePath = join(__dirname, '../../src/renderer/models')
  if (existsSync(alternativePath)) {
    console.log(`[Models] Using alternative path: ${alternativePath}`)
    return alternativePath
  }

  console.warn(`[Models] Neither path exists. Using default: ${builtPath}`)
  return builtPath // fallback to built path even if not exists
}

function listModels(): string[] {
  const modelsDir = getModelsDirectory()
  try {
    return readdirSync(modelsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
}

function listMotions(modelId: string): string[] {
  const modelsDir = getModelsDirectory()
  const motionsDir = join(modelsDir, modelId, 'runtime/motions')
  try {
    return readdirSync(motionsDir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.motion3.json'))
      .map((f) => f.name.replace(/\.motion3\.json$/, ''))
  } catch {
    return []
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

async function persistModelAndNotify(modelId: string): Promise<void> {
  try {
    const raw = await loadSettingsRaw()
    raw.modelId = modelId
    await saveSettingsRaw(raw)
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('model:changed', modelId)
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
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  tray = new Tray(nativeImage.createEmpty())
  buildTrayMenu()
}

function setupIPC(): void {
  ipcMain.on('window:close', () => {
    app.quit()
  })

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:toggle-always-on-top', () => {
    if (!mainWindow) return false
    const newValue = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(newValue)
    buildTrayMenu()
    return newValue
  })

  ipcMain.on('window:set-ignore-mouse', (_event, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on('window:move', (_event, x: number, y: number) => {
    if (typeof x === 'number' && typeof y === 'number') {
      mainWindow?.setPosition(Math.round(x), Math.round(y))
    }
  })

  ipcMain.handle('settings:get', async () => {
    const raw = await loadSettingsRaw()
    return Object.keys(raw).length > 0 ? raw : null
  })

  ipcMain.handle('settings:set', async (_event, data: Record<string, unknown>) => {
    await saveSettingsRaw(data)
  })

  ipcMain.handle('shortcuts:copy-to-clipboard', (_event, text: string) => {
    if (typeof text === 'string') {
      clipboard.writeText(text)
    }
  })

  ipcMain.handle('shortcuts:launch-app', (_event, appNameOrPath: string) => {
    return new Promise<void>((resolve, reject) => {
      if (typeof appNameOrPath !== 'string' || !appNameOrPath.trim()) {
        reject(new Error('App name or path is required'))
        return
      }
      const name = appNameOrPath.trim()
      if (process.platform === 'darwin') {
        exec(`open -a "${name.replace(/"/g, '\\"')}"`, (err) => {
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

  ipcMain.handle('model:set', async (_event, modelId: string) => {
    try {
      await persistModelAndNotify(modelId)
      buildTrayMenu()
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('models:list', () => {
    return listModels()
  })

  ipcMain.handle('motions:list', (_event, modelId: string) => {
    return listMotions(modelId)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.live2d.desktop')

  if (!gotTheLock) {
    app.quit()
    return
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIPC()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
