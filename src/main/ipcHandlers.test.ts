import { describe, expect, it, vi } from 'vitest'
import type { IpcMain } from 'electron'
import { createElectronMock, fakeIpcEvent } from '../../test/helpers/electron'
import { FakeWindow } from '../../test/helpers/fakeWindow'
import { MemorySettings } from '../../test/helpers/memorySettings'
import { IPC } from '../shared/ipc'
import { DesktopController } from './desktopController'
import { parseDragMessage, registerIpcHandlers } from './ipcHandlers'

function setup(isTrustedSender?: () => boolean) {
  const electron = createElectronMock()
  const win = new FakeWindow()
  const store = new MemorySettings()
  const controller = new DesktopController(win, store)
  const quit = vi.fn()
  const models = {
    list: vi.fn(async () => ({ models: [], selectedId: null })),
    select: vi.fn(async () => ({ models: [], selectedId: null })),
    importFromDialog: vi.fn(async () => ({ status: 'canceled' as const }))
  }
  registerIpcHandlers(electron.ipcMain as unknown as IpcMain, {
    controller,
    models,
    quit,
    isTrustedSender
  })
  return { electron, win, store, quit, models, event: fakeIpcEvent() }
}

describe('IPC handlers', () => {
  it('registers exactly the channels in the IPC table (minus main → renderer events)', () => {
    const { electron } = setup()
    const expected = Object.values(IPC).filter((c) => c !== IPC.stateChanged)
    expect(electron.registeredChannels()).toEqual([...expected].sort())
  })

  it('routes valid payloads to the controller', async () => {
    const { electron, win, store, quit, event } = setup()
    await expect(electron.invoke(IPC.setAlwaysOnTop, event, false)).resolves.toBe(false)
    expect(win.alwaysOnTop).toBe(false)
    await electron.invoke(IPC.setClickThrough, event, true)
    expect(win.ignoreMouse).toBe(true)
    electron.emit(IPC.updateCharacter, event, { opacity: 0.5 })
    expect(store.get().character.opacity).toBe(0.5)
    electron.emit(IPC.quit, event)
    expect(quit).toHaveBeenCalled()
  })

  it('rejects or ignores malformed payloads without changing state', async () => {
    const { electron, win, store, event } = setup()
    const before = structuredClone(store.get())
    await expect(electron.invoke(IPC.setAlwaysOnTop, event, 'yes')).rejects.toThrow()
    await expect(electron.invoke(IPC.setClickThrough, event, { value: true })).rejects.toThrow()
    electron.emit(IPC.updateCharacter, event, { scale: 'huge' })
    electron.emit(IPC.updateCharacter, event, { __proto__: { scale: 1 } })
    electron.emit(IPC.setPointerOverControls, event, 1)
    electron.emit(IPC.drag, event, { phase: 'teleport', screenX: 0, screenY: 0 })
    electron.emit(IPC.drag, event, { phase: 'move', screenX: Infinity, screenY: 0 })
    expect(store.get()).toEqual(before)
    expect(win.alwaysOnTop).toBe(true)
    expect(win.bounds).toEqual({ x: 100, y: 100, width: 400, height: 500 })
  })

  it('drops everything from an untrusted sender', async () => {
    const { electron, win, quit, event } = setup(() => false)
    await expect(electron.invoke(IPC.setAlwaysOnTop, event, false)).rejects.toThrow(/untrusted/)
    electron.emit(IPC.quit, event)
    expect(win.alwaysOnTop).toBe(true)
    expect(quit).not.toHaveBeenCalled()
  })
})

describe('model IPC (#9–#11)', () => {
  it('validates model ids before selecting', async () => {
    const { electron, models, event } = setup()
    await electron.invoke(IPC.selectModel, event, 'user:miku')
    expect(models.select).toHaveBeenCalledWith('user:miku')
    for (const bad of ['../../etc', 'miku', 42, null, 'user:../x']) {
      await expect(electron.invoke(IPC.selectModel, event, bad)).rejects.toThrow()
    }
    expect(models.select).toHaveBeenCalledTimes(1)
  })

  it('import takes no payload from the renderer (main opens the picker)', async () => {
    const { electron, models, event } = setup()
    await electron.invoke(IPC.importModel, event, '/etc/passwd')
    expect(models.importFromDialog).toHaveBeenCalledWith()
  })
})

describe('parseDragMessage', () => {
  it('accepts only well-formed drag messages', () => {
    expect(parseDragMessage({ phase: 'move', screenX: 1, screenY: 2 })).toEqual({
      phase: 'move',
      screenX: 1,
      screenY: 2
    })
    for (const bad of [null, 'x', { phase: 'move' }, { phase: 'move', screenX: '1', screenY: 2 }]) {
      expect(parseDragMessage(bad)).toBeNull()
    }
  })
})
