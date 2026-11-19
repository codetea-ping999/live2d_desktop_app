import { useState } from 'react'
import Live2DViewer from './components/Live2DViewer'
import ControlOverlay from './components/ControlOverlay'
import ErrorBoundary from './components/ErrorBoundary'

function App(): React.JSX.Element {
  const [scale, setScale] = useState(0.25)
  const [opacity, setOpacity] = useState(1.0)

  // Default model path - Hatsune Miku
  const modelPath =
    'https://cdn.jsdelivr.net/gh/evrstr/live2d-widget-models/live2d_evrstr/miku/model.json'

  return (
    <ErrorBoundary>
      <div className="app-container">
        <Live2DViewer modelPath={modelPath} scale={scale} opacity={opacity} />
        <ControlOverlay
          scale={scale}
          opacity={opacity}
          onScaleChange={setScale}
          onOpacityChange={setOpacity}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
