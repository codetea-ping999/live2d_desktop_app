import { describe, expect, it, vi } from 'vitest'
import { MemorySettings } from '../../test/helpers/memorySettings'
import type { ModelSummary } from '../shared/models'
import { ModelImportError } from './modelLibrary'
import { ModelService } from './modelService'

const model = (id: string): ModelSummary => ({
  id,
  name: id,
  source: id.startsWith('user') ? 'user' : 'bundled',
  cubismVersion: 4,
  url: `live2d-model://${id.replace(':', '/')}/m.model3.json`
})

function setup(
  models: ModelSummary[],
  selectedId: string | null = null,
  picked: string | null = '/x'
) {
  const library = {
    list: vi.fn(async () => models),
    import: vi.fn(async (): Promise<ModelSummary> => model('user:new'))
  }
  const store = new MemorySettings({ model: { selectedId } })
  const service = new ModelService(library, store, async () => picked)
  return { library, store, service }
}

describe('ModelService (#9, #11)', () => {
  it('restores the saved selection when the model still exists', async () => {
    const { service } = setup([model('user:a'), model('user:b')], 'user:b')
    expect((await service.list()).selectedId).toBe('user:b')
  })

  it('falls back to the first model when the saved one is gone, or null when empty', async () => {
    expect((await setup([model('user:a')], 'user:gone').service.list()).selectedId).toBe('user:a')
    expect((await setup([], 'user:gone').service.list()).selectedId).toBeNull()
  })

  it('persists a valid selection and ignores unknown ids', async () => {
    const { service, store } = setup([model('user:a'), model('bundled:b')])
    await service.select('bundled:b')
    expect(store.get().model.selectedId).toBe('bundled:b')
    await service.select('user:nope')
    expect(store.get().model.selectedId).toBe('bundled:b')
  })

  it('maps import outcomes to results', async () => {
    expect(await setup([], null, null).service.importFromDialog()).toEqual({ status: 'canceled' })

    const ok = setup([])
    expect(await ok.service.importFromDialog()).toMatchObject({ status: 'imported' })

    const bad = setup([])
    bad.library.import.mockRejectedValueOnce(new ModelImportError('Missing files: a.png.'))
    expect(await bad.service.importFromDialog()).toEqual({
      status: 'error',
      message: 'Missing files: a.png.'
    })
  })
})
