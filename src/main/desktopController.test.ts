import { describe, expect, it, vi } from 'vitest'
import { FakeWindow } from '../../test/helpers/fakeWindow'
import { MemorySettings } from '../../test/helpers/memorySettings'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { DesktopController } from './desktopController'

function setup(initial: unknown = DEFAULT_SETTINGS) {
  const win = new FakeWindow()
  const store = new MemorySettings(initial)
  const onStateChange = vi.fn()
  const controller = new DesktopController(win, store, {
    onStateChange,
    clickThroughShortcut: 'CommandOrControl+Shift+L'
  })
  return { win, store, controller, onStateChange }
}

describe('DesktopController', () => {
  describe('always on top (#6)', () => {
    it('applies the saved state on start', () => {
      const { win, controller } = setup({ window: { alwaysOnTop: false } })
      controller.applyInitialState()
      expect(win.alwaysOnTop).toBe(false)
      expect(controller.view().alwaysOnTop).toBe(false)
    })

    it('a change from any path updates window, settings, renderer and tray', () => {
      const { win, store, controller, onStateChange } = setup()
      controller.setAlwaysOnTop(false) // e.g. from the renderer
      expect(win.alwaysOnTop).toBe(false)
      expect(store.get().window.alwaysOnTop).toBe(false)
      expect(win.webContents.send).toHaveBeenLastCalledWith(
        'app:state-changed',
        expect.objectContaining({ alwaysOnTop: false })
      )
      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ alwaysOnTop: false })
      )
    })

    it('reports the real window state rather than an assumed one', () => {
      const { win, controller } = setup()
      win.alwaysOnTop = false // changed outside the controller (OS / window event)
      expect(controller.syncAlwaysOnTop()).toBe(false)
      expect(controller.view().alwaysOnTop).toBe(false)
    })
  })

  describe('click-through (#7)', () => {
    it('ignores the mouse (forwarding moves) and persists the mode', () => {
      const { win, store, controller } = setup()
      controller.setClickThrough(true)
      expect(win.ignoreMouse).toBe(true)
      expect(store.get().behavior.clickThrough).toBe(true)
      controller.toggleClickThrough()
      expect(win.ignoreMouse).toBe(false)
    })

    it('restores the saved mode on start', () => {
      const { win, controller } = setup({ behavior: { clickThrough: true } })
      controller.applyInitialState()
      expect(win.ignoreMouse).toBe(true)
    })

    it('hovering the controls temporarily makes the window clickable', () => {
      const { win, controller } = setup()
      controller.setClickThrough(true)
      controller.setPointerOverControls(true)
      expect(win.ignoreMouse).toBe(false)
      controller.setPointerOverControls(false)
      expect(win.ignoreMouse).toBe(true)
    })

    it('switching back to interactive clears the hover override', () => {
      const { win, controller } = setup()
      controller.setClickThrough(true)
      controller.setPointerOverControls(true)
      controller.setClickThrough(false)
      controller.setClickThrough(true)
      expect(win.ignoreMouse).toBe(true)
    })
  })

  describe('drag (#3)', () => {
    it('moves the window by the pointer delta and keeps its size', () => {
      const { win, store, controller } = setup()
      controller.drag({ phase: 'start', screenX: 500, screenY: 500 })
      controller.drag({ phase: 'move', screenX: 530, screenY: 480 })
      expect(win.bounds).toEqual({ x: 130, y: 80, width: 400, height: 500 })
      controller.drag({ phase: 'end', screenX: 540, screenY: 470 })
      expect(win.bounds).toEqual({ x: 140, y: 70, width: 400, height: 500 })
      expect(store.get().window.bounds).toEqual(win.bounds)
    })

    it('ignores moves without a start and drags in click-through mode', () => {
      const { win, controller } = setup()
      controller.drag({ phase: 'move', screenX: 900, screenY: 900 })
      expect(win.bounds.x).toBe(100)
      controller.setClickThrough(true)
      controller.drag({ phase: 'start', screenX: 0, screenY: 0 })
      controller.drag({ phase: 'move', screenX: 50, screenY: 50 })
      expect(win.bounds.x).toBe(100)
    })
  })

  describe('bounds (#4, #8)', () => {
    it('saves bounds but not while minimized', () => {
      const { win, store, controller } = setup()
      win.bounds = { x: 5, y: 6, width: 300, height: 400 }
      controller.saveBounds()
      expect(store.get().window.bounds).toEqual(win.bounds)
      win.minimized = true
      win.bounds = { x: -32000, y: -32000, width: 160, height: 160 }
      controller.saveBounds()
      expect(store.get().window.bounds).toEqual({ x: 5, y: 6, width: 300, height: 400 })
    })

    it('brings the window back when its display disappears', () => {
      const { win, controller } = setup()
      const laptop = { id: 1, workArea: { x: 0, y: 0, width: 1440, height: 900 } }
      win.bounds = { x: 2000, y: 100, width: 400, height: 500 }
      controller.ensureVisible([laptop], laptop)
      expect(win.bounds.x + win.bounds.width).toBeLessThanOrEqual(1440)
      expect(win.bounds.y + win.bounds.height).toBeLessThanOrEqual(900)
    })

    it('does nothing when the window is still visible', () => {
      const { win, store, controller } = setup()
      const laptop = { id: 1, workArea: { x: 0, y: 0, width: 1440, height: 900 } }
      const before = store.writes
      controller.ensureVisible([laptop], laptop)
      expect(win.bounds).toEqual({ x: 100, y: 100, width: 400, height: 500 })
      expect(store.writes).toBe(before)
    })
  })

  it('persists character settings (#5)', () => {
    const { store, controller } = setup()
    controller.updateCharacter({ scale: 0.5 })
    expect(store.get().character).toEqual({ scale: 0.5, opacity: 1 })
  })

  it('does not touch a destroyed window', () => {
    const { win, controller } = setup()
    win.destroyed = true
    expect(() => {
      controller.setAlwaysOnTop(false)
      controller.setClickThrough(true)
      controller.drag({ phase: 'start', screenX: 0, screenY: 0 })
      controller.saveBounds()
    }).not.toThrow()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })
})
