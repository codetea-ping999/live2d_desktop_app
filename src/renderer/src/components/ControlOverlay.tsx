import { useState, useCallback, useEffect } from 'react'
import {
    type AppShortcut,
    type TemplateShortcut
} from '../config/shortcuts'

interface ControlOverlayProps {
    scale: number
    opacity: number
    currentModel: string
    appShortcuts: AppShortcut[]
    templateShortcuts: TemplateShortcut[]
    onScaleChange: (scale: number) => void
    onOpacityChange: (opacity: number) => void
    onAppShortcutsChange: (shortcuts: AppShortcut[]) => void
    onTemplateShortcutsChange: (shortcuts: TemplateShortcut[]) => void
    onModelChange: (modelId: string) => void
}

function ControlOverlay({
    scale,
    opacity,
    currentModel,
    appShortcuts,
    templateShortcuts,
    onScaleChange,
    onOpacityChange,
    onAppShortcutsChange,
    onTemplateShortcutsChange,
    onModelChange
}: ControlOverlayProps): React.JSX.Element {
    const [isExpanded, setIsExpanded] = useState(false)
    const [alwaysOnTop, setAlwaysOnTop] = useState(true)
    const [activeTab, setActiveTab] = useState<'display' | 'models' | 'motions' | 'shortcuts'>('display')
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
    const [launchError, setLaunchError] = useState<string | null>(null)
    const [isEditingShortcuts, setIsEditingShortcuts] = useState(false)
    const [draftAppShortcuts, setDraftAppShortcuts] = useState<AppShortcut[]>([])
    const [draftTemplateShortcuts, setDraftTemplateShortcuts] = useState<TemplateShortcut[]>([])
    const [modelList, setModelList] = useState<string[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [motionList, setMotionList] = useState<string[]>([])
    const [isLoadingMotions, setIsLoadingMotions] = useState(false)

    useEffect(() => {
        if (isEditingShortcuts) return
        setDraftAppShortcuts(appShortcuts)
        setDraftTemplateShortcuts(templateShortcuts)
    }, [appShortcuts, templateShortcuts, isEditingShortcuts])

    useEffect(() => {
        if (activeTab === 'models' && modelList.length === 0 && !isLoadingModels) {
            setIsLoadingModels(true)
            window.api?.listModels?.().then((list) => {
                setModelList(list)
                setIsLoadingModels(false)
            }).catch(() => {
                setIsLoadingModels(false)
            })
        }
    }, [activeTab, modelList.length, isLoadingModels])

    useEffect(() => {
        if (activeTab === 'motions' && motionList.length === 0 && !isLoadingMotions) {
            setIsLoadingMotions(true)
            window.api?.listMotions?.(currentModel).then((list) => {
                setMotionList(list)
                setIsLoadingMotions(false)
            }).catch(() => {
                setIsLoadingMotions(false)
            })
        }
    }, [activeTab, currentModel, motionList.length, isLoadingMotions])

    const handleToggleAlwaysOnTop = useCallback(async () => {
        const result = await window.api?.toggleAlwaysOnTop?.()
        if (result !== undefined) setAlwaysOnTop(result)
    }, [])

    const handleClose = useCallback(() => {
        if (window.confirm('アプリケーションを終了しますか？')) {
            window.api?.closeWindow?.()
        }
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

    const handleModelChange = useCallback(async (modelId: string) => {
        const success = await window.api?.setModel?.(modelId)
        if (success) {
            onModelChange(modelId)
        }
    }, [onModelChange])

    const handleMotionChange = useCallback(async (motionId: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const motionController = (window as any).__motionController
        if (motionController && typeof motionController.playMotion === 'function') {
            motionController.playMotion(motionId)
        }
    }, [])

    const handleStartEditShortcuts = useCallback(() => {
        setDraftAppShortcuts(appShortcuts)
        setDraftTemplateShortcuts(templateShortcuts)
        setIsEditingShortcuts(true)
    }, [appShortcuts, templateShortcuts])

    const handleCancelEditShortcuts = useCallback(() => {
        setDraftAppShortcuts(appShortcuts)
        setDraftTemplateShortcuts(templateShortcuts)
        setIsEditingShortcuts(false)
    }, [appShortcuts, templateShortcuts])

    const handleSaveShortcuts = useCallback(() => {
        const cleanedApps = draftAppShortcuts
            .map((item) => ({
                ...item,
                label: item.label.trim(),
                appNameOrPath: item.appNameOrPath.trim()
            }))
            .filter((item) => item.label.length > 0 && item.appNameOrPath.length > 0)

        const cleanedTemplates = draftTemplateShortcuts
            .map((item) => ({
                ...item,
                label: item.label.trim(),
                text: item.text.trim()
            }))
            .filter((item) => item.label.length > 0 && item.text.length > 0)

        onAppShortcutsChange(cleanedApps)
        onTemplateShortcutsChange(cleanedTemplates)
        setIsEditingShortcuts(false)
    }, [
        draftAppShortcuts,
        draftTemplateShortcuts,
        onAppShortcutsChange,
        onTemplateShortcutsChange
    ])

    const addAppShortcut = useCallback(() => {
        const id = `app-${Date.now()}`
        setDraftAppShortcuts((prev) => [...prev, { id, label: '', appNameOrPath: '', icon: '🚀' }])
    }, [])

    const removeAppShortcut = useCallback((id: string) => {
        setDraftAppShortcuts((prev) => prev.filter((item) => item.id !== id))
    }, [])

    const updateAppShortcut = useCallback(
        (id: string, field: 'label' | 'appNameOrPath' | 'icon', value: string) => {
            setDraftAppShortcuts((prev) =>
                prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
            )
        },
        []
    )

    const addTemplateShortcut = useCallback(() => {
        const id = `template-${Date.now()}`
        setDraftTemplateShortcuts((prev) => [...prev, { id, label: '', text: '', icon: '📋' }])
    }, [])

    const removeTemplateShortcut = useCallback((id: string) => {
        setDraftTemplateShortcuts((prev) => prev.filter((item) => item.id !== id))
    }, [])

    const updateTemplateShortcut = useCallback(
        (id: string, field: 'label' | 'text' | 'icon', value: string) => {
            setDraftTemplateShortcuts((prev) =>
                prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
            )
        },
        []
    )

    return (
        <>
            {isExpanded && (
                <div
                    className="control-backdrop"
                    onClick={() => setIsExpanded(false)}
                />
            )}
            <div className={`control-overlay ${isExpanded ? 'expanded' : ''}`}>
                <button
                    className="control-toggle"
                    title="Settings"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
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
                            className={`control-tab ${activeTab === 'models' ? 'active' : ''}`}
                            onClick={() => setActiveTab('models')}
                        >
                            モデル
                        </button>
                        <button
                            type="button"
                            className={`control-tab ${activeTab === 'motions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('motions')}
                        >
                            モーション
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

                    {activeTab === 'models' && (
                        <div className="models-section">
                            {isLoadingModels ? (
                                <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    読み込み中...
                                </p>
                            ) : modelList.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    モデルが見つかりません
                                </p>
                            ) : (
                                <div className="models-grid">
                                    {modelList.map((modelId) => (
                                        <button
                                            key={modelId}
                                            type="button"
                                            className={`model-btn ${currentModel === modelId ? 'active' : ''}`}
                                            onClick={() => handleModelChange(modelId)}
                                        >
                                            {modelId}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'motions' && (
                        <div className="motions-section">
                            {isLoadingMotions ? (
                                <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    読み込み中...
                                </p>
                            ) : motionList.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    モーションが見つかりません
                                </p>
                            ) : (
                                <div className="motions-grid">
                                    {motionList.map((motionId) => (
                                        <button
                                            key={motionId}
                                            type="button"
                                            className="motion-btn"
                                            onClick={() => handleMotionChange(motionId)}
                                        >
                                            {motionId}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="shortcuts-section">
                            <div className="shortcuts-actions">
                                {!isEditingShortcuts ? (
                                    <button
                                        type="button"
                                        className="control-btn"
                                        onClick={handleStartEditShortcuts}
                                    >
                                        編集
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="control-btn"
                                            onClick={handleSaveShortcuts}
                                        >
                                            保存
                                        </button>
                                        <button
                                            type="button"
                                            className="control-btn"
                                            onClick={handleCancelEditShortcuts}
                                        >
                                            キャンセル
                                        </button>
                                    </>
                                )}
                            </div>

                            {!isEditingShortcuts ? (
                                <>
                            <div className="shortcuts-block">
                                <span className="shortcuts-block-title">アプリ起動</span>
                                <div className="shortcuts-grid">
                                    {appShortcuts.map((app) => (
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
                                    {templateShortcuts.map((t) => (
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
                                </>
                            ) : (
                                <>
                                    <div className="shortcuts-block">
                                        <span className="shortcuts-block-title">アプリ起動（編集）</span>
                                        <div className="shortcuts-edit-list">
                                            {draftAppShortcuts.map((app) => (
                                                <div key={app.id} className="shortcuts-edit-row">
                                                    <input
                                                        type="text"
                                                        placeholder="ラベル"
                                                        value={app.label}
                                                        onChange={(e) =>
                                                            updateAppShortcut(app.id, 'label', e.target.value)
                                                        }
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="App名 / パス"
                                                        value={app.appNameOrPath}
                                                        onChange={(e) =>
                                                            updateAppShortcut(
                                                                app.id,
                                                                'appNameOrPath',
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="アイコン"
                                                        value={app.icon ?? ''}
                                                        onChange={(e) =>
                                                            updateAppShortcut(app.id, 'icon', e.target.value)
                                                        }
                                                    />
                                                    <button
                                                        type="button"
                                                        className="shortcut-remove-btn"
                                                        onClick={() => removeAppShortcut(app.id)}
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            className="control-btn"
                                            onClick={addAppShortcut}
                                        >
                                            + アプリ追加
                                        </button>
                                    </div>

                                    <div className="shortcuts-block">
                                        <span className="shortcuts-block-title">定型文（編集）</span>
                                        <div className="shortcuts-edit-list">
                                            {draftTemplateShortcuts.map((t) => (
                                                <div key={t.id} className="shortcuts-edit-row">
                                                    <input
                                                        type="text"
                                                        placeholder="ラベル"
                                                        value={t.label}
                                                        onChange={(e) =>
                                                            updateTemplateShortcut(
                                                                t.id,
                                                                'label',
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="コピー文"
                                                        value={t.text}
                                                        onChange={(e) =>
                                                            updateTemplateShortcut(
                                                                t.id,
                                                                'text',
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="アイコン"
                                                        value={t.icon ?? ''}
                                                        onChange={(e) =>
                                                            updateTemplateShortcut(t.id, 'icon', e.target.value)
                                                        }
                                                    />
                                                    <button
                                                        type="button"
                                                        className="shortcut-remove-btn"
                                                        onClick={() => removeTemplateShortcut(t.id)}
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            className="control-btn"
                                            onClick={addTemplateShortcut}
                                        >
                                            + 定型文追加
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
            </div>
        </>
    )
}

export default ControlOverlay
