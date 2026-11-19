import { useCallback, useRef, useState } from 'react'
import Live2DViewer from './components/Live2DViewer'
import ControlOverlay from './components/ControlOverlay'
import ErrorBoundary from './components/ErrorBoundary'
import type { LoadResult } from './live2d/types'
import { useAppState } from './useAppState'
import { useModelLibrary } from './useModelLibrary'

function App(): React.JSX.Element | null {
  const appState = useAppState()
  const { library, importing, select, importModel } = useModelLibrary()
  // Local copy so sliders stay smooth; main persists (debounced).
  const [character, setCharacter] = useState<{ scale: number; opacity: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const lastGoodId = useRef<string | null>(null)

  const updateCharacter = useCallback(
    (patch: { scale?: number; opacity?: number }) => {
      setCharacter((current) => ({ ...(current ?? appState!.character), ...patch }))
      window.api.updateCharacter(patch)
    },
    [appState]
  )

  const selectedId = library?.selectedId ?? null
  const selected = library?.models.find((m) => m.id === selectedId) ?? null

  // Roll the selection back to the last model that loaded, so a broken model
  // never sticks as the saved choice (#11). The runtime keeps showing it.
  const onLoadResult = useCallback(
    (result: LoadResult) => {
      if (result.status === 'loaded') {
        lastGoodId.current = selectedId
      } else if (result.status === 'error') {
        setNotice(`Could not load this model: ${result.error.message}`)
        const fallback = lastGoodId.current
        if (fallback && fallback !== selectedId) void select(fallback)
      }
    },
    [selectedId, select]
  )

  const onImport = useCallback(async () => {
    setNotice(null)
    const result = await importModel()
    if (result.status === 'error') setNotice(result.message)
  }, [importModel])

  const onSelect = useCallback(
    (id: string) => {
      setNotice(null)
      void select(id)
    },
    [select]
  )

  if (!appState || !library) return null
  const { scale, opacity } = character ?? appState.character

  return (
    <ErrorBoundary>
      <div className="app-container">
        <Live2DViewer
          modelUrl={selected?.url ?? null}
          scale={scale}
          opacity={opacity}
          interactive={!appState.clickThrough}
          onLoadResult={onLoadResult}
        />
        {library.models.length === 0 && (
          <div className="empty-state">
            <p>No Live2D model yet.</p>
            <button className="control-btn" onClick={() => void onImport()} disabled={importing}>
              {importing ? 'Importing…' : '＋ Import model'}
            </button>
            <p className="empty-hint">Choose a model folder (Cubism 4 or Cubism 2).</p>
          </div>
        )}
        <ControlOverlay
          state={appState}
          scale={scale}
          opacity={opacity}
          onScaleChange={(value) => updateCharacter({ scale: value })}
          onOpacityChange={(value) => updateCharacter({ opacity: value })}
          models={library.models}
          selectedModelId={selectedId}
          onSelectModel={onSelect}
          onImportModel={() => void onImport()}
          importing={importing}
          notice={notice}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
