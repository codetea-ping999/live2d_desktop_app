import type { ImportResult, ModelListResult } from './models'

/**
 * The complete list of IPC channels between renderer and main.
 * Anything not listed here is not part of the app's API.
 */
export const IPC = {
  getState: 'app:get-state',
  stateChanged: 'app:state-changed',
  quit: 'app:quit',
  updateCharacter: 'settings:update-character',
  setAlwaysOnTop: 'window:set-always-on-top',
  setClickThrough: 'window:set-click-through',
  /** Temporarily accept the mouse while hovering the controls in click-through mode. */
  setPointerOverControls: 'window:set-pointer-over-controls',
  drag: 'window:drag',
  listModels: 'models:list',
  selectModel: 'models:select',
  importModel: 'models:import'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

/** What the renderer is allowed to know about app state. */
export interface AppStateView {
  alwaysOnTop: boolean
  clickThrough: boolean
  character: { scale: number; opacity: number }
  /** Accelerator that toggles click-through from anywhere, e.g. "CommandOrControl+Shift+L". */
  clickThroughShortcut: string | null
}

export type DragPhase = 'start' | 'move' | 'end'

export interface DragMessage {
  phase: DragPhase
  /** Pointer position in screen DIP coordinates (MouseEvent.screenX / screenY). */
  screenX: number
  screenY: number
}

/** The API exposed to the renderer as `window.api` (implemented in preload). */
export interface Live2DAPI {
  getState(): Promise<AppStateView>
  /** Returns an unsubscribe function. */
  onStateChanged(listener: (state: AppStateView) => void): () => void
  setAlwaysOnTop(value: boolean): Promise<boolean>
  setClickThrough(value: boolean): Promise<boolean>
  setPointerOverControls(value: boolean): void
  updateCharacter(patch: { scale?: number; opacity?: number }): void
  drag(message: DragMessage): void
  quit(): void
  listModels(): Promise<ModelListResult>
  selectModel(id: string): Promise<ModelListResult>
  /** Opens a folder / file picker in main; nothing is read in the renderer. */
  importModel(): Promise<ImportResult>
}
