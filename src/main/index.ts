import { app, shell, BrowserWindow, ipcMain, Menu, Tray, nativeImage, clipboard } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

const SETTINGS_FILENAME = 'settings.json'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

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

  // Allow the window to be visible on all workspaces (macOS)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  // Create a small tray icon
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
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
      checked: true,
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

// IPC Handlers
function setupIPC(): void {
  ipcMain.on('window:close', () => {
    app.quit()
  })

  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:toggle-always-on-top', () => {
    if (mainWindow) {
      const newValue = !mainWindow.isAlwaysOnTop()
      mainWindow.setAlwaysOnTop(newValue)
      return newValue
    }
    return false
  })

  ipcMain.on('window:set-ignore-mouse', (_event, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // ドラッグによるウィンドウ移動（設計書: window:move R->M）
  ipcMain.on('window:move', (_event, x: number, y: number) => {
    if (typeof x === 'number' && typeof y === 'number') {
      mainWindow?.setPosition(Math.round(x), Math.round(y))
    }
  })

  // SettingsStore: settings.json の読み書き（メインプロセスで実行）
  ipcMain.handle('settings:get', async () => {
    const userData = app.getPath('userData')
    const path = join(userData, SETTINGS_FILENAME)
    if (!existsSync(path)) return null
    try {
      const raw = await readFile(path, 'utf-8')
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:set', async (_event, data: Record<string, unknown>) => {
    const userData = app.getPath('userData')
    if (!existsSync(userData)) await mkdir(userData, { recursive: true })
    const path = join(userData, SETTINGS_FILENAME)
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
  })

  // Shortcuts: copy text to clipboard (main process for reliability)
  ipcMain.handle('shortcuts:copy-to-clipboard', (_event, text: string) => {
    if (typeof text === 'string') {
      clipboard.writeText(text)
    }
  })

  // Shortcuts: launch app (macOS: open -a "AppName")
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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.live2d.desktop')

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
