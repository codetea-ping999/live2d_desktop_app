import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElectronMock, type ElectronMock } from '../../test/helpers/electron'

let electron: ElectronMock

async function loadPreload(): Promise<Record<string, (...args: unknown[]) => unknown>> {
  vi.resetModules()
  vi.doMock('electron', () => electron.module)
  vi.doMock('@electron-toolkit/preload', () => ({ electronAPI: { kind: 'toolkit' } }))
  vi.stubGlobal('process', { ...process, contextIsolated: true })
  await import('./index')
  return electron.exposed.get('api') as Record<string, (...args: unknown[]) => unknown>
}

describe('preload API contract', () => {
  beforeEach(() => {
    electron = createElectronMock()
  })

  it('exposes the window controls on window.api', async () => {
    const api = await loadPreload()
    expect(Object.keys(api).sort()).toEqual(
      ['closeWindow', 'minimizeWindow', 'setIgnoreMouse', 'toggleAlwaysOnTop'].sort()
    )
  })

  it('maps each call to its IPC channel', async () => {
    const api = await loadPreload()
    api.closeWindow()
    api.minimizeWindow()
    api.setIgnoreMouse(true)
    await api.toggleAlwaysOnTop()
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith('window:close')
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith('window:minimize')
    expect(electron.ipcRenderer.send).toHaveBeenCalledWith('window:set-ignore-mouse', true)
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('window:toggle-always-on-top')
  })
})
