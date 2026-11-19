/**
 * Library-agnostic contracts for the character runtime.
 *
 * `CharacterRuntime` only talks to these interfaces, so the Pixi /
 * pixi-live2d-display specifics live in one adapter (`pixiRuntime.ts`) and the
 * lifecycle logic can be tested with plain mocks.
 */

export interface Size {
  width: number
  height: number
}

/** A loaded Live2D model, wrapped by the adapter. */
export interface CharacterModel {
  setScale(value: number): void
  setOpacity(value: number): void
  /** Size after scaling, in CSS pixels. */
  getSize(): Size
  setPosition(x: number, y: number): void
  focus(x: number, y: number): void
  playMotion(group: string): void
  playExpression(name?: string): void
  /** True when the point (CSS pixels, viewport coordinates) is on the character. */
  containsPoint(x: number, y: number): boolean
  /** Forward a click/tap so hit areas can trigger motions. */
  tap(x: number, y: number): void
  destroy(): void
}

/** Where models are displayed (the Pixi stage in production). */
export interface CharacterStage<M extends CharacterModel = CharacterModel> {
  add(model: M): void
  remove(model: M): void
  destroy(): void
}

export type ModelLoader<M extends CharacterModel = CharacterModel> = (
  url: string,
  signal: AbortSignal
) => Promise<M>

export type RuntimePhase = 'idle' | 'loading' | 'ready' | 'error'

export interface RuntimeStatus {
  phase: RuntimePhase
  /** URL of the model currently on stage, if any. */
  currentUrl: string | null
  /** URL being loaded while phase is 'loading'. */
  pendingUrl: string | null
  /** Message of the last failed load while phase is 'error'. */
  error: string | null
}

export type LoadResult =
  | { status: 'loaded'; url: string }
  | { status: 'stale'; url: string }
  | { status: 'error'; url: string; error: Error }
