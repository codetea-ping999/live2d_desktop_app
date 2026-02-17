import { useState, useEffect, useCallback } from 'react'
import Live2DViewer from './components/Live2DViewer'
import ControlOverlay from './components/ControlOverlay'
import { getModelPath } from './repository/ModelRepository'
import { loadSettings, saveSettings } from './settings/SettingsStore'
import type { AppSettings } from './settings/types'
import { defaultSettings } from './settings/types'
import { defaultAppShortcuts, defaultTemplateShortcuts } from './config/shortcuts'

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => setSettings({ ...defaultSettings }))
  }, [])

  // モデル切替イベント購読
  useEffect(() => {
    const unsub = window.api?.onModelChanged?.((modelId: string) => {
      setSettings((prev) => {
        if (!prev) return prev
        const next = { ...prev, modelId }
        return next
      })
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
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

  const handleAppShortcutsChange = useCallback((appShortcuts: AppSettings['appShortcuts']) => {
    setSettings((prev) => {
      if (!prev) return prev
      const next = { ...prev, appShortcuts }
      saveSettings(next).catch(console.error)
      return next
    })
  }, [])

  const handleTemplateShortcutsChange = useCallback(
    (templateShortcuts: AppSettings['templateShortcuts']) => {
      setSettings((prev) => {
        if (!prev) return prev
        const next = { ...prev, templateShortcuts }
        saveSettings(next).catch(console.error)
        return next
      })
    },
    []
  )

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
          currentModel={settings.modelId}
          appShortcuts={settings.appShortcuts ?? defaultAppShortcuts}
          templateShortcuts={settings.templateShortcuts ?? defaultTemplateShortcuts}
          onScaleChange={handleScaleChange}
          onOpacityChange={handleOpacityChange}
          onAppShortcutsChange={handleAppShortcutsChange}
          onTemplateShortcutsChange={handleTemplateShortcutsChange}
          onModelChange={(modelId) => setSettings((prev) => prev ? { ...prev, modelId } : prev)}
        />
      </div>
    )
  } catch (err) {
    console.error('App render error:', err)
    return (
      <div className="error-container">
        <p className="error-message">Something went wrong: {String(err)}</p>
      </div>
    )
  }
}

export default App
