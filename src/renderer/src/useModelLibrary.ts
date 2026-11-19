import { useCallback, useEffect, useState } from 'react'
import type { ImportResult, ModelListResult } from '../../shared/models'

export interface ModelLibraryState {
  library: ModelListResult | null
  importing: boolean
  select: (id: string) => Promise<void>
  importModel: () => Promise<ImportResult>
}

export function useModelLibrary(): ModelLibraryState {
  const [library, setLibrary] = useState<ModelListResult | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    let active = true
    window.api
      .listModels()
      .then((result) => {
        if (active) setLibrary(result)
      })
      .catch((error) => {
        console.error('Failed to list models:', error)
        if (active) setLibrary({ models: [], selectedId: null })
      })
    return () => {
      active = false
    }
  }, [])

  const select = useCallback(async (id: string) => {
    setLibrary(await window.api.selectModel(id))
  }, [])

  const importModel = useCallback(async (): Promise<ImportResult> => {
    setImporting(true)
    try {
      const result = await window.api.importModel()
      if (result.status === 'imported') {
        // Refresh the list and switch to the new model right away.
        setLibrary(await window.api.selectModel(result.model.id))
      }
      return result
    } finally {
      setImporting(false)
    }
  }, [])

  return { library, importing, select, importModel }
}
