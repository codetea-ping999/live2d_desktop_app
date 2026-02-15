import { useState } from 'react'
import Live2DViewer from './components/Live2DViewer'
import ControlOverlay from './components/ControlOverlay'

function App(): React.JSX.Element {
  const [scale, setScale] = useState(0.25)
  const [opacity, setOpacity] = useState(1.0)

  // Default model path - Hatsune Miku
  const modelPath = 'https://cdn.jsdelivr.net/gh/evrstr/live2d-widget-models/live2d_evrstr/miku/model.json'

  try {
    return (
      <div className="app-container">
        <Live2DViewer modelPath={modelPath} scale={scale} opacity={opacity} />
        <ControlOverlay
          scale={scale}
          opacity={opacity}
          onScaleChange={setScale}
          onOpacityChange={setOpacity}
        />
      </div>
    )
  } catch (err) {
    console.error('App render error:', err)
    return <div style={{ color: 'red', padding: 20 }}>Something went wrong: {String(err)}</div>
  }
}

export default App
