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

  it('exposes exactly the typed Live2D API on window.api', async () => {
    const api = await loadPreload()
    expect(Object.keys(api).sort()).toEqual(
      [
        'drag',
        'getState',
        'importModel',
        'listModels',
        'onStateChanged',
        'quit',
        'selectModel',
        'setAlwaysOnTop',
        'setClickThrough',
        'setPointerOverControls',
        'updateCharacter'
      ].sort()
    )
  })

  it('maps each call to its IPC channel', async () => {
    const api = await loadPreload()
    await api.getState()
    await api.setAlwaysOnTop(false)
    await api.setClickThrough(true)
    api.setPointerOverControls(true)
    api.updateCharacter({ scale: 0.3 })
    api.drag({ phase: 'start', screenX: 1, screenY: 2 })
    api.quit()
    expect(electron.ipcRenderer.invoke.mock.calls).toEqual([
      ['app:get-state'],
      ['window:set-always-on-top', false],
      ['window:set-click-through', true]
    ])
    expect(electron.ipcRenderer.send.mock.calls).toEqual([
      ['window:set-pointer-over-controls', true],
      ['settings:update-character', { scale: 0.3 }],
      ['window:drag', { phase: 'start', screenX: 1, screenY: 2 }],
      ['app:quit']
    ])
  })

  it('onStateChanged returns an unsubscribe that removes the listener', async () => {
    const api = await loadPreload()
    const seen: unknown[] = []
    const off = api.onStateChanged((state: unknown) => seen.push(state)) as () => void
    electron.pushToRenderer('app:state-changed', { alwaysOnTop: false })
    off()
    electron.pushToRenderer('app:state-changed', { alwaysOnTop: true })
    expect(seen).toEqual([{ alwaysOnTop: false }])
  })
})
