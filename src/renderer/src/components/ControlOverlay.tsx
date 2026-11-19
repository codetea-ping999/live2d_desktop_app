import { useState } from 'react'
import type { AppStateView } from '../../../shared/ipc'
import { OPACITY_RANGE, SCALE_RANGE } from '../../../shared/settings'

interface ControlOverlayProps {
  state: AppStateView
  scale: number
  opacity: number
  onScaleChange: (scale: number) => void
  onOpacityChange: (opacity: number) => void
}

function formatShortcut(accelerator: string | null): string | null {
  if (!accelerator) return null
  if (!navigator.userAgent.includes('Mac')) return accelerator.replace('CommandOrControl', 'Ctrl')
  return accelerator
    .replace('CommandOrControl', '⌘')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replaceAll('+', '')
}

function ControlOverlay({
  state,
  scale,
  opacity,
  onScaleChange,
  onOpacityChange
}: ControlOverlayProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const shortcut = formatShortcut(state.clickThroughShortcut)

  const enter = (): void => {
    setIsExpanded(true)
    // In click-through mode the window ignores clicks; hovering the controls
    // temporarily makes it clickable so the user can always switch back (#7).
    window.api.setPointerOverControls(true)
  }
  const leave = (): void => {
    setIsExpanded(false)
    window.api.setPointerOverControls(false)
  }

  return (
    <div
      className={`control-overlay ${isExpanded ? 'expanded' : ''}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <button className="control-toggle" title="Settings">
        {state.clickThrough ? '👻' : '⚙️'}
      </button>

      {isExpanded && (
        <div className="control-panel">
          <div className="control-group">
            <label>
              <span className="control-label">Scale</span>
              <input
                type="range"
                min={SCALE_RANGE.min}
                max={SCALE_RANGE.max}
                step={SCALE_RANGE.step}
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
                min={OPACITY_RANGE.min}
                max={OPACITY_RANGE.max}
                step={OPACITY_RANGE.step}
                value={opacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              />
              <span className="control-value">{Math.round(opacity * 100)}%</span>
            </label>
          </div>

          <div className="control-buttons">
            <button
              className={`control-btn ${state.alwaysOnTop ? 'active' : ''}`}
              onClick={() => void window.api.setAlwaysOnTop(!state.alwaysOnTop)}
              title="Always on Top"
            >
              📌 {state.alwaysOnTop ? 'Pinned' : 'Unpinned'}
            </button>
            <button
              className={`control-btn ${state.clickThrough ? 'active' : ''}`}
              onClick={() => void window.api.setClickThrough(!state.clickThrough)}
              title={
                shortcut ? `Click-through (toggle anywhere with ${shortcut})` : 'Click-through'
              }
            >
              👻 {state.clickThrough ? 'Click-through' : 'Interactive'}
            </button>
            <button
              className="control-btn close-btn"
              onClick={() => window.api.quit()}
              title="Quit"
            >
              ✕ Close
            </button>
          </div>
          {state.clickThrough && (
            <p className="control-hint">
              Clicks pass through the character.
              {shortcut
                ? ` Press ${shortcut} or use the tray menu to switch back.`
                : ' Use the tray menu to switch back.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default ControlOverlay
