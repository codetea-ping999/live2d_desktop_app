import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { MIN_WINDOW_SIZE } from '../shared/settings'
import { resolveWindowBounds } from '../shared/windowBounds'
import { DesktopController } from './desktopController'
import { registerIpcHandlers } from './ipcHandlers'
import { SettingsStore } from './settingsStore'

/** Global escape hatch from click-through mode (#7). */
const CLICK_THROUGH_SHORTCUT = 'CommandOrControl+Shift+L'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let controller: DesktopController | null = null
let store: SettingsStore | null = null
let registeredShortcut: string | null = null

function displaysForPlacement(): {
  displays: { id: number; workArea: Electron.Rectangle }[]
  primary: { id: number; workArea: Electron.Rectangle }
} {
  return { displays: screen.getAllDisplays(), primary: screen.getPrimaryDisplay() }
}

function createWindow(settings: SettingsStore): BrowserWindow {
  const { displays, primary } = displaysForPlacement()
  const bounds = resolveWindowBounds(settings.get().window.bounds, displays, primary)

  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: settings.get().window.alwaysOnTop,
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
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

function rebuildTrayMenu(): void {
  if (!tray || !controller) return
  const state = controller.view()
  const ctl = controller
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: (): void => {
          if (mainWindow?.isVisible()) mainWindow.hide()
          else mainWindow?.show()
        }
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: state.alwaysOnTop,
        click: (item): void => void ctl.setAlwaysOnTop(item.checked)
      },
      {
        label: 'Click-through',
        type: 'checkbox',
        checked: state.clickThrough,
        accelerator: registeredShortcut ?? undefined,
        click: (item): void => void ctl.setClickThrough(item.checked)
      },
      { type: 'separator' },
      { label: 'Quit', click: (): void => app.quit() }
    ])
  )
}

function createTray(): void {
  const image = nativeImage.createFromPath(icon).resize({ width: 18, height: 18 })
  tray = new Tray(image)
  tray.setToolTip('Live2D Desktop')
  rebuildTrayMenu()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.live2d.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  store = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
  const win = createWindow(store)
  mainWindow = win

  registeredShortcut = globalShortcut.register(CLICK_THROUGH_SHORTCUT, () =>
    controller?.toggleClickThrough()
  )
    ? CLICK_THROUGH_SHORTCUT
    : null

  controller = new DesktopController(win, store, {
    onStateChange: () => rebuildTrayMenu(),
    clickThroughShortcut: registeredShortcut
  })
  controller.applyInitialState()
  const ctl = controller

  win.on('move', () => ctl.saveBounds())
  win.on('resize', () => ctl.saveBounds())
  win.on('always-on-top-changed', () => ctl.syncAlwaysOnTop())
  win.on('closed', () => {
    mainWindow = null
  })

  const keepVisible = (): void => {
    const { displays, primary } = displaysForPlacement()
    ctl.ensureVisible(displays, primary)
  }
  screen.on('display-removed', keepVisible)
  screen.on('display-metrics-changed', keepVisible)

  registerIpcHandlers(ipcMain, { controller: ctl, quit: () => app.quit() })
  createTray()
})

app.on('before-quit', () => store?.flush())

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  app.quit()
})
