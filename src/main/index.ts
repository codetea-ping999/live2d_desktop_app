import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  session,
  shell,
  Tray
} from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { isAppUrl, isSafeExternalUrl, type AppOrigin } from './security'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { MIN_WINDOW_SIZE } from '../shared/settings'
import { resolveWindowBounds } from '../shared/windowBounds'
import { DesktopController } from './desktopController'
import { registerIpcHandlers } from './ipcHandlers'
import { ModelLibrary } from './modelLibrary'
import { ModelService } from './modelService'
import { MODEL_PROTOCOL } from '../shared/models'
import { SettingsStore } from './settingsStore'

/** Global escape hatch from click-through mode (#7). */
const CLICK_THROUGH_SHORTCUT = 'CommandOrControl+Shift+L'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let controller: DesktopController | null = null
let store: SettingsStore | null = null
let registeredShortcut: string | null = null

// Local models are served through a custom scheme so the renderer can load
// them with fetch / <img> (CORS-enabled for WebGL textures) without file://
// access or any network (#9).
protocol.registerSchemesAsPrivileged([
  {
    scheme: MODEL_PROTOCOL,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

function bundledModelsRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models')
    : join(app.getAppPath(), 'src', 'renderer', 'models')
}

function registerModelProtocol(library: ModelLibrary): void {
  protocol.handle(MODEL_PROTOCOL, async (request) => {
    const file = library.resolveFileUrl(request.url)
    if (!file) return new Response('Not found', { status: 404 })
    const response = await net.fetch(pathToFileURL(file).toString())
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'no-cache')
    return new Response(response.body, { status: response.status, headers })
  })
}

async function pickModelPath(): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Import Live2D model',
    buttonLabel: 'Import',
    message: 'Choose a model folder or its *.model3.json / model.json file',
    // macOS can offer folders and files in one panel; elsewhere pick a folder.
    properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openDirectory'],
    filters: [{ name: 'Live2D model', extensions: ['json'] }]
  }
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options)
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
}

const rendererIndex = join(__dirname, '../renderer/index.html')
const appOrigin: AppOrigin = {
  devServerUrl: is.dev ? (process.env['ELECTRON_RENDERER_URL'] ?? null) : null,
  rendererFileUrl: pathToFileURL(rendererIndex).toString()
}

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  // Allow the window to be visible on all workspaces (macOS)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('ready-to-show', () => win.show())

  // No new windows; https links open in the user's browser, nothing else.
  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // The renderer may never navigate away from the app page.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url, appOrigin)) event.preventDefault()
  })
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (appOrigin.devServerUrl) {
    win.loadURL(appOrigin.devServerUrl)
  } else {
    win.loadFile(rendererIndex)
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

  // The app needs no camera, microphone, notifications, geolocation, …
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)

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

  const library = new ModelLibrary({
    userRoot: join(app.getPath('userData'), 'models'),
    bundledRoot: bundledModelsRoot()
  })
  registerModelProtocol(library)
  const models = new ModelService(library, store, pickModelPath)

  registerIpcHandlers(ipcMain, {
    controller: ctl,
    models,
    quit: () => app.quit(),
    // Only our own window's main frame, showing our own page, may call IPC.
    isTrustedSender: (event) =>
      event.sender === win.webContents &&
      event.senderFrame !== null &&
      event.senderFrame === win.webContents.mainFrame &&
      isAppUrl(event.senderFrame.url, appOrigin)
  })
  createTray()
})

app.on('before-quit', () => store?.flush())

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  app.quit()
})
