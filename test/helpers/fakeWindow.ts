import { vi } from 'vitest'
import type { ControlledWindow } from '../../src/main/desktopController'
import type { Rect } from '../../src/shared/windowBounds'

/** BrowserWindow stand-in that tracks the state the controller changes. */
export class FakeWindow implements ControlledWindow {
  alwaysOnTop = true
  ignoreMouse = false
  minimized = false
  destroyed = false
  bounds: Rect = { x: 100, y: 100, width: 400, height: 500 }
  readonly webContents = { send: vi.fn() }

  isDestroyed(): boolean {
    return this.destroyed
  }
  isMinimized(): boolean {
    return this.minimized
  }
  isAlwaysOnTop(): boolean {
    return this.alwaysOnTop
  }
  setAlwaysOnTop(flag: boolean): void {
    this.alwaysOnTop = flag
  }
  setIgnoreMouseEvents(ignore: boolean): void {
    this.ignoreMouse = ignore
  }
  getBounds(): Rect {
    return { ...this.bounds }
  }
  setBounds(bounds: Rect): void {
    this.bounds = { ...bounds }
  }
}
