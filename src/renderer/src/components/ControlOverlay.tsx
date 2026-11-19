import { useState, useCallback } from 'react'

interface ControlOverlayProps {
  scale: number
  opacity: number
  onScaleChange: (scale: number) => void
  onOpacityChange: (opacity: number) => void
}

function ControlOverlay({
  scale,
  opacity,
  onScaleChange,
  onOpacityChange
}: ControlOverlayProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const result = await window.api.toggleAlwaysOnTop()
    setAlwaysOnTop(result)
  }, [])

  const handleClose = useCallback(() => {
    window.api.closeWindow()
  }, [])

  return (
    <div
      className={`control-overlay ${isExpanded ? 'expanded' : ''}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Toggle button */}
      <button className="control-toggle" title="Settings">
        ⚙️
      </button>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="control-panel">
          <div className="control-group">
            <label>
              <span className="control-label">Scale</span>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.01"
                value={scale}
                onChange={(e) => onScaleChange(parseFloat(e.target.value))}
              />
              <span className="control-value">{Math.round(scale * 100)}%</span>
            </label>
          </div>

          <div className="control-group">
            <label>
              <span className="control-label">Opacity</span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              />
              <span className="control-value">{Math.round(opacity * 100)}%</span>
            </label>
          </div>

          <div className="control-buttons">
            <button
              className={`control-btn ${alwaysOnTop ? 'active' : ''}`}
              onClick={handleToggleAlwaysOnTop}
              title="Always on Top"
            >
              📌 {alwaysOnTop ? 'Pinned' : 'Unpinned'}
            </button>
            <button className="control-btn close-btn" onClick={handleClose} title="Quit">
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ControlOverlay
