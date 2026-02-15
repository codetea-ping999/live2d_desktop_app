import { useState, useEffect, useCallback } from 'react'
import Live2DViewer from './components/Live2DViewer'
import ControlOverlay from './components/ControlOverlay'
import { getModelPath } from './repository/ModelRepository'
import { loadSettings, saveSettings } from './settings/SettingsStore'
import type { AppSettings } from './settings/types'
import { defaultSettings } from './settings/types'

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => setSettings({ ...defaultSettings }))
  }, [])

  const handleScaleChange = useCallback((scale: number) => {
    setSettings((prev) => {
      if (!prev) return prev
      const next = { ...prev, scale }
      saveSettings(next).catch(console.error)
      return next
    })
  }, [])

  const handleOpacityChange = useCallback((opacity: number) => {
    setSettings((prev) => {
      if (!prev) return prev
      const next = { ...prev, opacity }
      saveSettings(next).catch(console.error)
      return next
    })
  }, [])

  if (settings === null) {
    return (
      <div className="app-container">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  const modelPath = getModelPath(settings.modelId)

  try {
    return (
      <div className="app-container">
        <Live2DViewer
          modelPath={modelPath}
          scale={settings.scale}
          opacity={settings.opacity}
        />
        <ControlOverlay
          scale={settings.scale}
          opacity={settings.opacity}
          onScaleChange={handleScaleChange}
          onOpacityChange={handleOpacityChange}
        />
      </div>
    )
  } catch (err) {
    console.error('App render error:', err)
    return (
      <div style={{ color: 'red', padding: 20 }}>
        Something went wrong: {String(err)}
      </div>
    )
  }
}

export default App
