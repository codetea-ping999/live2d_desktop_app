import { useState, useCallback } from 'react'
import {
    defaultAppShortcuts,
    defaultTemplateShortcuts,
    type AppShortcut,
    type TemplateShortcut
} from '../config/shortcuts'

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
    const [activeTab, setActiveTab] = useState<'display' | 'shortcuts'>('display')
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
    const [launchError, setLaunchError] = useState<string | null>(null)

    const handleToggleAlwaysOnTop = useCallback(async () => {
        const result = await window.api?.toggleAlwaysOnTop?.()
        if (result !== undefined) setAlwaysOnTop(result)
    }, [])

    const handleClose = useCallback(() => {
        window.api?.closeWindow?.()
    }, [])

    const handleLaunchApp = useCallback(async (app: AppShortcut) => {
        setLaunchError(null)
        try {
            await window.api?.launchApp?.(app.appNameOrPath)
        } catch (err) {
            setLaunchError(err instanceof Error ? err.message : '起動に失敗しました')
        }
    }, [])

    const handleCopyTemplate = useCallback(async (template: TemplateShortcut) => {
        setCopyFeedback(null)
        try {
            await window.api?.copyToClipboard?.(template.text)
            setCopyFeedback(template.label)
            setTimeout(() => setCopyFeedback(null), 1500)
        } catch {
            setCopyFeedback('コピー失敗')
            setTimeout(() => setCopyFeedback(null), 1500)
        }
    }, [])

    return (
        <div
            className={`control-overlay ${isExpanded ? 'expanded' : ''}`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <button className="control-toggle" title="Settings">
                ⚙️
            </button>

            {isExpanded && (
                <div className="control-panel">
                    <div className="control-tabs">
                        <button
                            type="button"
                            className={`control-tab ${activeTab === 'display' ? 'active' : ''}`}
                            onClick={() => setActiveTab('display')}
                        >
                            表示
                        </button>
                        <button
                            type="button"
                            className={`control-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('shortcuts')}
                        >
                            ショートカット
                        </button>
                    </div>

                    {activeTab === 'display' && (
                        <>
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
                                        onChange={(e) =>
                                            onOpacityChange(parseFloat(e.target.value))
                                        }
                                    />
                                    <span className="control-value">
                                        {Math.round(opacity * 100)}%
                                    </span>
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
                                <button
                                    className="control-btn close-btn"
                                    onClick={handleClose}
                                    title="Quit"
                                >
                                    ✕ Close
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="shortcuts-section">
                            <div className="shortcuts-block">
                                <span className="shortcuts-block-title">アプリ起動</span>
                                <div className="shortcuts-grid">
                                    {defaultAppShortcuts.map((app) => (
                                        <button
                                            key={app.id}
                                            type="button"
                                            className="shortcut-btn app-btn"
                                            onClick={() => handleLaunchApp(app)}
                                            title={app.appNameOrPath}
                                        >
                                            <span className="shortcut-icon">{app.icon ?? '🚀'}</span>
                                            <span className="shortcut-label">{app.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {launchError && (
                                    <p className="shortcuts-error">{launchError}</p>
                                )}
                            </div>
                            <div className="shortcuts-block">
                                <span className="shortcuts-block-title">定型文（コピー）</span>
                                <div className="shortcuts-grid templates">
                                    {defaultTemplateShortcuts.map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            className="shortcut-btn template-btn"
                                            onClick={() => handleCopyTemplate(t)}
                                            title={t.text.slice(0, 50)}
                                        >
                                            <span className="shortcut-icon">{t.icon ?? '📋'}</span>
                                            <span className="shortcut-label">{t.label}</span>
                                            {copyFeedback === t.label && (
                                                <span className="shortcut-copied">Copied!</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default ControlOverlay
