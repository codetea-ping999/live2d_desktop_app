import * as PIXI from 'pixi.js'
import type { Live2DModel as Live2DModelType } from 'pixi-live2d-display'
import { CharacterRuntime } from './CharacterRuntime'
import type { CharacterModel, CharacterStage } from './types'

type Live2DModelClass = typeof Live2DModelType
type Live2DInstance = InstanceType<Live2DModelClass>

declare global {
  interface Window {
    /** Cubism 4/5 Core (live2dcubismcore.min.js). */
    Live2DCubismCore?: unknown
    /** Cubism 2 runtime (live2d.min.js). */
    Live2D?: unknown
  }
}

export function isCubism4Entry(url: string): boolean {
  return /\.model3\.json(?:$|[?#])/i.test(url)
}

let live2dModule: Promise<Live2DModelClass> | null = null

/**
 * pixi-live2d-display's bundles throw at import time when their Cubism
 * runtime script is missing, so pick the bundle that matches the runtimes
 * actually present on the page.
 */
function loadLive2DModule(): Promise<Live2DModelClass> {
  if (!live2dModule) {
    const has4 = Boolean(window.Live2DCubismCore)
    const has2 = Boolean(window.Live2D)
    const imported =
      has4 && has2
        ? import('pixi-live2d-display')
        : has4
          ? import('pixi-live2d-display/cubism4')
          : has2
            ? import('pixi-live2d-display/cubism2')
            : Promise.reject(
                new Error(
                  'Live2D runtime not found. Place live2dcubismcore.min.js (Cubism 4) and/or live2d.min.js (Cubism 2) in src/renderer/public/lib/.'
                )
              )
    live2dModule = imported.then((mod) => {
      mod.Live2DModel.registerTicker(PIXI.Ticker)
      return mod.Live2DModel
    })
    // Allow a retry after the user installs the runtime and reloads.
    live2dModule.catch(() => {
      live2dModule = null
    })
  }
  return live2dModule
}

function assertRuntimeFor(url: string): void {
  if (isCubism4Entry(url)) {
    if (!window.Live2DCubismCore) {
      throw new Error(
        'This is a Cubism 4 model, but live2dcubismcore.min.js is not installed (see src/renderer/public/lib/README.md).'
      )
    }
  } else if (!window.Live2D) {
    throw new Error(
      'This is a Cubism 2 model, but live2d.min.js is not installed (see src/renderer/public/lib/README.md).'
    )
  }
}

/** Adapter from pixi-live2d-display's Live2DModel to CharacterModel. */
export class PixiCharacterModel implements CharacterModel {
  constructor(readonly displayObject: Live2DInstance) {
    displayObject.on('hit', (hitAreas: string[]) => {
      if (hitAreas.includes('Body') || hitAreas.includes('body')) {
        this.playMotion('TapBody')
        this.playMotion('tap_body')
      } else if (hitAreas.includes('Head') || hitAreas.includes('head')) {
        this.playExpression()
      }
    })
  }

  setScale(value: number): void {
    this.displayObject.scale.set(value)
  }

  setOpacity(value: number): void {
    this.displayObject.alpha = value
  }

  getSize(): { width: number; height: number } {
    return { width: this.displayObject.width, height: this.displayObject.height }
  }

  setPosition(x: number, y: number): void {
    this.displayObject.position.set(x, y)
  }

  focus(x: number, y: number): void {
    if (this.displayObject.internalModel) this.displayObject.focus(x, y)
  }

  playMotion(group: string): void {
    void this.displayObject.motion(group).catch(() => undefined)
  }

  playExpression(name?: string): void {
    void this.displayObject.expression(name).catch(() => undefined)
  }

  containsPoint(x: number, y: number): boolean {
    return this.displayObject.getBounds().contains(x, y)
  }

  tap(x: number, y: number): void {
    this.displayObject.tap(x, y)
  }

  destroy(): void {
    this.displayObject.destroy({ children: true, texture: true, baseTexture: true })
  }
}

/**
 * Create a runtime that renders into a canvas it owns inside `container`.
 * Owning the canvas means a StrictMode remount never reuses a canvas whose
 * WebGL context was lost by a previous `Application.destroy()`.
 */
export function createPixiRuntime(
  container: HTMLElement,
  options: { initialScale?: number; initialOpacity?: number } = {}
): CharacterRuntime<PixiCharacterModel> {
  const canvas = document.createElement('canvas')
  canvas.className = 'live2d-canvas'
  container.appendChild(canvas)

  const app = new PIXI.Application({
    view: canvas,
    backgroundAlpha: 0,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  })

  const stage: CharacterStage<PixiCharacterModel> = {
    add: (model) => void app.stage.addChild(model.displayObject),
    remove: (model) => void app.stage.removeChild(model.displayObject),
    destroy: () => {
      app.destroy(false, { children: true, texture: true, baseTexture: true })
      canvas.remove()
    }
  }

  return new CharacterRuntime<PixiCharacterModel>({
    stage,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    loadModel: async (url) => {
      assertRuntimeFor(url)
      const Live2DModel = await loadLive2DModule()
      const model = await Live2DModel.from(url, { autoInteract: false })
      return new PixiCharacterModel(model)
    },
    initialScale: options.initialScale,
    initialOpacity: options.initialOpacity
  })
}
