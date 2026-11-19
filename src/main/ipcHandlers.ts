import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { IPC, type DragMessage } from '../shared/ipc'
import { parseCharacterPatch } from '../shared/settings'
import type { DesktopController } from './desktopController'

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function parseDragMessage(value: unknown): DragMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const { phase, screenX, screenY } = value as Record<string, unknown>
  if (phase !== 'start' && phase !== 'move' && phase !== 'end') return null
  if (typeof screenX !== 'number' || !Number.isFinite(screenX)) return null
  if (typeof screenY !== 'number' || !Number.isFinite(screenY)) return null
  return { phase, screenX, screenY }
}

export interface IpcHandlerDeps {
  controller: DesktopController
  quit: () => void
  /** Reject messages that do not come from the app's own renderer. */
  isTrustedSender?: (event: IpcMainEvent | IpcMainInvokeEvent) => boolean
}

class IpcRejected extends Error {}

/**
 * Register every renderer → main channel. Each handler validates its payload
 * and ignores (or rejects) anything malformed, so bad input can never put the
 * main process into an invalid state.
 */
export function registerIpcHandlers(ipcMain: IpcMain, deps: IpcHandlerDeps): void {
  const { controller, quit } = deps
  const trusted = deps.isTrustedSender ?? (() => true)

  const on = (channel: string, fn: (payload: unknown) => void): void => {
    ipcMain.on(channel, (event, payload) => {
      if (!trusted(event)) return
      fn(payload)
    })
  }
  const handle = (channel: string, fn: (payload: unknown) => unknown): void => {
    ipcMain.handle(channel, (event, payload) => {
      if (!trusted(event)) throw new IpcRejected(`untrusted sender for ${channel}`)
      return fn(payload)
    })
  }

  handle(IPC.getState, () => controller.view())

  handle(IPC.setAlwaysOnTop, (value) => {
    if (!isBoolean(value)) throw new IpcRejected('expected boolean')
    return controller.setAlwaysOnTop(value)
  })

  handle(IPC.setClickThrough, (value) => {
    if (!isBoolean(value)) throw new IpcRejected('expected boolean')
    return controller.setClickThrough(value)
  })

  on(IPC.setPointerOverControls, (value) => {
    if (isBoolean(value)) controller.setPointerOverControls(value)
  })

  on(IPC.updateCharacter, (value) => {
    const patch = parseCharacterPatch(value)
    if (patch) controller.updateCharacter(patch)
  })

  on(IPC.drag, (value) => {
    const message = parseDragMessage(value)
    if (message) controller.drag(message)
  })

  on(IPC.quit, () => quit())
}
