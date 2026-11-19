import type { AppStateView, DragMessage } from '../shared/ipc'
import { IPC } from '../shared/ipc'
import type { CharacterSettingsPatch, Settings } from '../shared/settings'
import {
  resolveWindowBounds,
  sameBounds,
  type DisplayLike,
  type Rect
} from '../shared/windowBounds'

/** The parts of BrowserWindow the controller needs (mockable in tests). */
export interface ControlledWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  isAlwaysOnTop(): boolean
  setAlwaysOnTop(flag: boolean): void
  setIgnoreMouseEvents(ignore: boolean, options?: { forward?: boolean }): void
  getBounds(): Rect
  setBounds(bounds: Rect): void
  webContents: { send(channel: string, ...args: unknown[]): void }
}

export interface SettingsLike {
  get(): Settings
  update(mutate: (current: Settings) => Settings): Settings
}

export interface DesktopControllerOptions {
  /** Called whenever tray/menu state should be rebuilt. */
  onStateChange?: (view: AppStateView) => void
  clickThroughShortcut?: string | null
}

/**
 * Single source of truth for desktop window behaviour (#3–#8).
 * Tray, renderer and global shortcut all go through these methods, and every
 * change is applied to the BrowserWindow, persisted, and broadcast.
 */
export class DesktopController {
  private pointerOverControls = false
  private dragOrigin: { screenX: number; screenY: number; bounds: Rect } | null = null
  private readonly onStateChange: (view: AppStateView) => void
  private readonly shortcut: string | null

  constructor(
    private readonly win: ControlledWindow,
    private readonly store: SettingsLike,
    options: DesktopControllerOptions = {}
  ) {
    this.onStateChange = options.onStateChange ?? (() => undefined)
    this.shortcut = options.clickThroughShortcut ?? null
  }

  /** Apply persisted state to a freshly created window. */
  applyInitialState(): void {
    const s = this.store.get()
    this.win.setAlwaysOnTop(s.window.alwaysOnTop)
    this.applyMouseMode()
  }

  view(): AppStateView {
    const s = this.store.get()
    return {
      alwaysOnTop: this.alive() ? this.win.isAlwaysOnTop() : s.window.alwaysOnTop,
      clickThrough: s.behavior.clickThrough,
      character: { ...s.character },
      clickThroughShortcut: this.shortcut
    }
  }

  // --- always on top (#6) ---------------------------------------------------

  setAlwaysOnTop(value: boolean): boolean {
    if (this.alive()) this.win.setAlwaysOnTop(value)
    return this.syncAlwaysOnTop()
  }

  /** Read the real window state (e.g. after 'always-on-top-changed'). */
  syncAlwaysOnTop(): boolean {
    const actual = this.alive() ? this.win.isAlwaysOnTop() : this.store.get().window.alwaysOnTop
    if (actual !== this.store.get().window.alwaysOnTop) {
      this.store.update((s) => ({ ...s, window: { ...s.window, alwaysOnTop: actual } }))
    }
    this.broadcast()
    return actual
  }

  // --- click-through (#7) -----------------------------------------------------

  setClickThrough(value: boolean): boolean {
    this.store.update((s) => ({ ...s, behavior: { ...s.behavior, clickThrough: value } }))
    if (!value) this.pointerOverControls = false
    this.applyMouseMode()
    this.broadcast()
    return value
  }

  toggleClickThrough(): boolean {
    return this.setClickThrough(!this.store.get().behavior.clickThrough)
  }

  /** While hovering the controls, accept the mouse so the user can switch back. */
  setPointerOverControls(value: boolean): void {
    if (this.pointerOverControls === value) return
    this.pointerOverControls = value
    this.applyMouseMode()
  }

  isIgnoringMouse(): boolean {
    return this.store.get().behavior.clickThrough && !this.pointerOverControls
  }

  private applyMouseMode(): void {
    if (!this.alive()) return
    // forward: true keeps mousemove flowing so eye-tracking and the hover
    // escape hatch still work in click-through mode.
    this.win.setIgnoreMouseEvents(this.isIgnoringMouse(), { forward: true })
  }

  // --- character settings (#5) ------------------------------------------------

  updateCharacter(patch: CharacterSettingsPatch): void {
    this.store.update((s) => ({ ...s, character: { ...s.character, ...patch } }))
    this.onStateChange(this.view())
  }

  // --- drag (#3) ----------------------------------------------------------------

  drag(message: DragMessage): void {
    if (!this.alive()) return
    if (this.isIgnoringMouse()) return
    if (message.phase === 'start') {
      this.dragOrigin = {
        screenX: message.screenX,
        screenY: message.screenY,
        bounds: this.win.getBounds()
      }
      return
    }
    const origin = this.dragOrigin
    if (!origin) return
    const { bounds } = origin
    // Keep width/height from drag start: setPosition alone can grow
    // transparent windows on scaled Windows displays.
    this.win.setBounds({
      x: Math.round(bounds.x + message.screenX - origin.screenX),
      y: Math.round(bounds.y + message.screenY - origin.screenY),
      width: bounds.width,
      height: bounds.height
    })
    if (message.phase === 'end') {
      this.dragOrigin = null
      this.saveBounds()
    }
  }

  // --- bounds (#4, #8) ------------------------------------------------------------

  /** Call from the window's move / resize events. */
  saveBounds(): void {
    if (!this.alive() || this.win.isMinimized()) return
    const bounds = this.win.getBounds()
    this.store.update((s) => ({ ...s, window: { ...s.window, bounds } }))
  }

  /** Bring the window back on-screen after the display layout changed. */
  ensureVisible(displays: DisplayLike[], primary: DisplayLike): void {
    if (!this.alive()) return
    const current = this.win.getBounds()
    const next = resolveWindowBounds(current, displays, primary)
    if (!sameBounds(current, next)) {
      this.win.setBounds(next)
      this.saveBounds()
    }
  }

  // ---------------------------------------------------------------------------------

  private alive(): boolean {
    return !this.win.isDestroyed()
  }

  private broadcast(): void {
    const view = this.view()
    if (this.alive()) this.win.webContents.send(IPC.stateChanged, view)
    this.onStateChange(view)
  }
}
