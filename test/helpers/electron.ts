import { vi } from 'vitest'

type Listener = (event: FakeIpcEvent, ...args: unknown[]) => unknown

export interface FakeIpcEvent {
  sender: { id: number; send: ReturnType<typeof vi.fn> }
  senderFrame: { url: string } | null
}

export function fakeIpcEvent(url = 'file:///app/out/renderer/index.html', id = 1): FakeIpcEvent {
  return { sender: { id, send: vi.fn() }, senderFrame: { url } }
}

/**
 * Minimal stand-ins for the Electron modules used by main / preload.
 * Use with `vi.mock('electron', () => mock.module)`.
 */
export function createElectronMock() {
  const onListeners = new Map<string, Listener>()
  const handlers = new Map<string, Listener>()
  const exposed = new Map<string, unknown>()
  const rendererListeners = new Map<string, Set<(...args: unknown[]) => void>>()

  const ipcMain = {
    on: vi.fn((channel: string, fn: Listener) => void onListeners.set(channel, fn)),
    handle: vi.fn((channel: string, fn: Listener) => void handlers.set(channel, fn)),
    removeHandler: vi.fn((channel: string) => void handlers.delete(channel))
  }

  const ipcRenderer = {
    send: vi.fn(),
    invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
    on: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
      if (!rendererListeners.has(channel)) rendererListeners.set(channel, new Set())
      rendererListeners.get(channel)!.add(fn)
    }),
    removeListener: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
      rendererListeners.get(channel)?.delete(fn)
    })
  }

  const contextBridge = {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => void exposed.set(key, api))
  }

  return {
    module: { ipcMain, ipcRenderer, contextBridge },
    ipcMain,
    ipcRenderer,
    contextBridge,
    exposed,
    /** Simulate `ipcRenderer.send` arriving in main. */
    emit(channel: string, event: FakeIpcEvent, ...args: unknown[]): unknown {
      const fn = onListeners.get(channel)
      if (!fn) throw new Error(`no ipcMain.on listener for ${channel}`)
      return fn(event, ...args)
    },
    /** Simulate `ipcRenderer.invoke` arriving in main. */
    async invoke(channel: string, event: FakeIpcEvent, ...args: unknown[]): Promise<unknown> {
      const fn = handlers.get(channel)
      if (!fn) throw new Error(`no ipcMain.handle handler for ${channel}`)
      return fn(event, ...args)
    },
    /** Simulate main sending an event to the renderer. */
    pushToRenderer(channel: string, ...args: unknown[]): void {
      rendererListeners.get(channel)?.forEach((fn) => fn({}, ...args))
    },
    registeredChannels(): string[] {
      return [...onListeners.keys(), ...handlers.keys()].sort()
    }
  }
}

export type ElectronMock = ReturnType<typeof createElectronMock>
