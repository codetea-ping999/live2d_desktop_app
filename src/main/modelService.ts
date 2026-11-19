import type { ImportResult, ModelListResult } from '../shared/models'
import type { SettingsLike } from './desktopController'
import { ModelImportError, type ModelLibrary } from './modelLibrary'

/** Library + selection persistence, as exposed over IPC (#9–#11). */
export class ModelService {
  constructor(
    private readonly library: Pick<ModelLibrary, 'list' | 'import'>,
    private readonly store: SettingsLike,
    /** Ask the user for a folder / entry file; null when canceled. */
    private readonly pickPath: () => Promise<string | null>
  ) {}

  async list(): Promise<ModelListResult> {
    const models = await this.library.list()
    const saved = this.store.get().model.selectedId
    const selectedId = models.some((m) => m.id === saved) ? saved : (models[0]?.id ?? null)
    return { models, selectedId }
  }

  /** Persist the selection if the model exists; returns the new list state. */
  async select(id: string): Promise<ModelListResult> {
    const models = await this.library.list()
    if (models.some((m) => m.id === id)) {
      this.store.update((s) => ({ ...s, model: { selectedId: id } }))
    }
    return this.list()
  }

  async importFromDialog(): Promise<ImportResult> {
    const picked = await this.pickPath()
    if (!picked) return { status: 'canceled' }
    try {
      const model = await this.library.import(picked)
      return { status: 'imported', model }
    } catch (error) {
      const message =
        error instanceof ModelImportError
          ? error.message
          : `Import failed: ${error instanceof Error ? error.message : String(error)}`
      return { status: 'error', message }
    }
  }
}
