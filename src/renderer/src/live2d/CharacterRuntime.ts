import type {
  CharacterModel,
  CharacterStage,
  LoadResult,
  ModelLoader,
  RuntimeStatus,
  Size
} from './types'

export interface CharacterRuntimeOptions<M extends CharacterModel> {
  stage: CharacterStage<M>
  loadModel: ModelLoader<M>
  viewport: () => Size
  initialScale?: number
  initialOpacity?: number
}

export const IDLE_STATUS: RuntimeStatus = {
  phase: 'idle',
  currentUrl: null,
  pendingUrl: null,
  error: null
}

/** Centre horizontally and stand the character on the bottom edge. */
export function layoutPosition(model: Size, viewport: Size): { x: number; y: number } {
  return {
    x: (viewport.width - model.width) / 2,
    y: viewport.height - model.height
  }
}

/**
 * Owns the Live2D model lifecycle.
 *
 * Every `load()` gets a generation number. Only the latest generation may
 * commit to the stage; anything that resolves later than a newer request, or
 * after `destroy()`, is destroyed instead of being shown (#13).
 * The latest scale / opacity are kept here and re-applied whenever a model is
 * committed, so values changed during a load are never lost.
 */
export class CharacterRuntime<M extends CharacterModel = CharacterModel> {
  private readonly stage: CharacterStage<M>
  private readonly loadModel: ModelLoader<M>
  private readonly viewport: () => Size

  private model: M | null = null
  private generation = 0
  private inflight: AbortController | null = null
  private destroyed = false
  private scale: number
  private opacity: number
  private status: RuntimeStatus = IDLE_STATUS
  private readonly listeners = new Set<() => void>()

  constructor(options: CharacterRuntimeOptions<M>) {
    this.stage = options.stage
    this.loadModel = options.loadModel
    this.viewport = options.viewport
    this.scale = options.initialScale ?? 0.25
    this.opacity = options.initialOpacity ?? 1
  }

  // --- status (useSyncExternalStore-compatible) ---------------------------

  getStatus = (): RuntimeStatus => this.status

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setStatus(next: Partial<RuntimeStatus>): void {
    if (this.destroyed) return
    this.status = { ...this.status, ...next }
    this.listeners.forEach((fn) => fn())
  }

  // --- model lifecycle ----------------------------------------------------

  get isDestroyed(): boolean {
    return this.destroyed
  }

  get currentModel(): M | null {
    return this.model
  }

  async load(url: string): Promise<LoadResult> {
    if (this.destroyed) return { status: 'stale', url }

    const generation = ++this.generation
    this.inflight?.abort()
    const controller = new AbortController()
    this.inflight = controller
    this.setStatus({ phase: 'loading', pendingUrl: url, error: null })

    let model: M
    try {
      model = await this.loadModel(url, controller.signal)
    } catch (err) {
      if (!this.isCurrent(generation)) return { status: 'stale', url }
      const error = err instanceof Error ? err : new Error(String(err))
      this.inflight = null
      // Keep the previous healthy model on stage (if any).
      this.setStatus({ phase: 'error', pendingUrl: null, error: error.message })
      return { status: 'error', url, error }
    }

    if (!this.isCurrent(generation)) {
      safeDestroy(model)
      return { status: 'stale', url }
    }

    this.inflight = null
    const previous = this.model
    if (previous) {
      this.stage.remove(previous)
      safeDestroy(previous)
    }
    this.model = model
    model.setScale(this.scale)
    model.setOpacity(this.opacity)
    this.stage.add(model)
    this.layout()
    this.setStatus({ phase: 'ready', currentUrl: url, pendingUrl: null, error: null })
    return { status: 'loaded', url }
  }

  private isCurrent(generation: number): boolean {
    return !this.destroyed && generation === this.generation
  }

  /** Remove the current model (e.g. the library became empty). */
  clear(): void {
    if (this.destroyed) return
    this.generation++
    this.inflight?.abort()
    this.inflight = null
    if (this.model) {
      this.stage.remove(this.model)
      safeDestroy(this.model)
      this.model = null
    }
    this.setStatus(IDLE_STATUS)
  }

  destroy(): void {
    if (this.destroyed) return
    this.generation++
    this.inflight?.abort()
    this.inflight = null
    if (this.model) {
      this.stage.remove(this.model)
      safeDestroy(this.model)
      this.model = null
    }
    this.destroyed = true
    this.listeners.clear()
    this.stage.destroy()
  }

  // --- appearance -----------------------------------------------------------

  setScale(value: number): void {
    this.scale = value
    if (this.model) {
      this.model.setScale(value)
      this.layout()
    }
  }

  setOpacity(value: number): void {
    this.opacity = value
    this.model?.setOpacity(value)
  }

  getScale(): number {
    return this.scale
  }

  getOpacity(): number {
    return this.opacity
  }

  layout(): void {
    if (!this.model) return
    const { x, y } = layoutPosition(this.model.getSize(), this.viewport())
    this.model.setPosition(x, y)
  }

  // --- interaction ------------------------------------------------------------

  focus(x: number, y: number): void {
    this.model?.focus(x, y)
  }

  containsPoint(x: number, y: number): boolean {
    return this.model?.containsPoint(x, y) ?? false
  }

  tap(x: number, y: number): void {
    this.model?.tap(x, y)
  }

  playMotion(group: string): void {
    this.model?.playMotion(group)
  }

  playExpression(name?: string): void {
    this.model?.playExpression(name)
  }
}

function safeDestroy(model: CharacterModel): void {
  try {
    model.destroy()
  } catch (err) {
    console.warn('Failed to destroy Live2D model:', err)
  }
}

/**
 * Wire resize / mousemove to a runtime. Returns a disposer that removes
 * exactly the listeners it added, so remounts never stack listeners.
 */
export function bindWindowEvents(runtime: CharacterRuntime, target: EventTarget): () => void {
  const onResize = (): void => runtime.layout()
  const onMouseMove = (event: Event): void => {
    const { clientX, clientY } = event as MouseEvent
    runtime.focus(clientX, clientY)
  }
  target.addEventListener('resize', onResize)
  target.addEventListener('mousemove', onMouseMove)
  return () => {
    target.removeEventListener('resize', onResize)
    target.removeEventListener('mousemove', onMouseMove)
  }
}
