import { useCallback, useState } from 'react'
import Live2DViewer from './components/Live2DViewer'
import ControlOverlay from './components/ControlOverlay'
import ErrorBoundary from './components/ErrorBoundary'
import { useAppState } from './useAppState'

// Default model path - Hatsune Miku
const DEFAULT_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/evrstr/live2d-widget-models/live2d_evrstr/miku/model.json'

function App(): React.JSX.Element | null {
  const appState = useAppState()
  // Local copy so sliders stay smooth; main persists (debounced).
  const [character, setCharacter] = useState<{ scale: number; opacity: number } | null>(null)

  const updateCharacter = useCallback(
    (patch: { scale?: number; opacity?: number }) => {
      setCharacter((current) => ({ ...(current ?? appState!.character), ...patch }))
      window.api.updateCharacter(patch)
    },
    [appState]
  )

  if (!appState) return null
  const { scale, opacity } = character ?? appState.character

  return (
    <ErrorBoundary>
      <div className="app-container">
        <Live2DViewer
          modelUrl={DEFAULT_MODEL_URL}
          scale={scale}
          opacity={opacity}
          interactive={!appState.clickThrough}
        />
        <ControlOverlay
          state={appState}
          scale={scale}
          opacity={opacity}
          onScaleChange={(value) => updateCharacter({ scale: value })}
          onOpacityChange={(value) => updateCharacter({ opacity: value })}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
