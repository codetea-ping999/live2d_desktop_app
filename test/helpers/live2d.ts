import { vi } from 'vitest'
import type { CharacterModel, CharacterStage } from '../../src/renderer/src/live2d/types'
import { deferred, type Deferred } from './deferred'

/** In-memory CharacterModel that records what the runtime did to it. */
export class MockModel implements CharacterModel {
  scale = 1
  opacity = 1
  x = 0
  y = 0
  destroyed = false
  readonly focus = vi.fn()
  readonly tap = vi.fn()
  readonly playMotion = vi.fn()
  readonly playExpression = vi.fn()

  constructor(
    readonly url: string,
    private readonly baseSize = { width: 400, height: 800 }
  ) {}

  setScale(value: number): void {
    this.scale = value
  }
  setOpacity(value: number): void {
    this.opacity = value
  }
  getSize(): { width: number; height: number } {
    return { width: this.baseSize.width * this.scale, height: this.baseSize.height * this.scale }
  }
  setPosition(x: number, y: number): void {
    this.x = x
    this.y = y
  }
  containsPoint(x: number, y: number): boolean {
    const { width, height } = this.getSize()
    return x >= this.x && x <= this.x + width && y >= this.y && y <= this.y + height
  }
  destroy(): void {
    if (this.destroyed) throw new Error(`double destroy: ${this.url}`)
    this.destroyed = true
  }
}

export class MockStage implements CharacterStage<MockModel> {
  children: MockModel[] = []
  destroyed = false
  add(model: MockModel): void {
    if (this.destroyed) throw new Error('add to destroyed stage')
    this.children.push(model)
  }
  remove(model: MockModel): void {
    this.children = this.children.filter((m) => m !== model)
  }
  destroy(): void {
    this.destroyed = true
  }
}

/**
 * Loader whose requests stay pending until the test resolves/rejects them,
 * in any order it likes.
 */
export function createControlledLoader() {
  const pending = new Map<string, Deferred<MockModel>[]>()
  const created: MockModel[] = []
  const loader = vi.fn<(url: string, signal: AbortSignal) => Promise<MockModel>>((url) => {
    const d = deferred<MockModel>()
    if (!pending.has(url)) pending.set(url, [])
    pending.get(url)!.push(d)
    return d.promise
  })
  const take = (url: string): Deferred<MockModel> => {
    const queue = pending.get(url)
    const d = queue?.shift()
    if (!d) throw new Error(`no pending load for ${url}`)
    return d
  }
  return {
    loader,
    created,
    resolve(url: string): MockModel {
      const model = new MockModel(url)
      created.push(model)
      take(url).resolve(model)
      return model
    },
    reject(url: string, error = new Error(`failed: ${url}`)): void {
      take(url).reject(error)
    }
  }
}
