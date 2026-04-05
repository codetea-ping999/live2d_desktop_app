import { useEffect, useMemo, useRef, useState } from 'react'
import type { OllamaMessage, OllamaStatus } from '../../../preload/index'
import './AIChatDock.css'

interface AIChatDockProps {
  messages: OllamaMessage[]
  busy: boolean
  error: string | null
  onSubmit: (prompt: string) => void
  onClear: () => void
  status: OllamaStatus | null
  onRefreshStatus: () => void
}

const AI_DOCK_MODE_KEY = 'live2d.aiDock.mode'
const promptSuggestions = [
  '今日やることを3つに整理して',
  '今の気分が上がる一言をください',
  'Live2D デスクトップ用の便利機能を3案ください'
]

type DockMode = 'expanded' | 'compact' | 'hidden'

function loadInitialMode(): DockMode {
  if (typeof window === 'undefined') return 'expanded'

  const raw = window.localStorage.getItem(AI_DOCK_MODE_KEY)
  return raw === 'compact' || raw === 'hidden' ? raw : 'expanded'
}

function AIChatDock({
  messages,
  busy,
  error,
  onSubmit,
  onClear,
  status,
  onRefreshStatus
}: AIChatDockProps): React.JSX.Element {
  const [mode, setMode] = useState<DockMode>(loadInitialMode)
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_DOCK_MODE_KEY, mode)
    } catch {
      // ignore storage errors
    }
  }, [mode])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [messages, busy])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isQuickFocus = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j'
      if (!isQuickFocus) return
      event.preventDefault()
      setMode('expanded')
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const subtitle = useMemo(() => {
    if (!status) return 'Ollama の接続状態を確認中です。'
    if (status.modelAvailable) return `${status.model} @ ${status.baseUrl}`
    return `${status.model} が見つかりません`
  }, [status])

  const submit = (): void => {
    const nextPrompt = prompt.trim()
    if (!nextPrompt || busy) return
    onSubmit(nextPrompt)
    setPrompt('')
  }

  if (mode === 'hidden') {
    return (
      <aside className="ai-dock hidden">
        <button type="button" className="ai-dock-peek" onClick={() => setMode('expanded')}>
          <strong>AI</strong>
          <span>表示</span>
        </button>
      </aside>
    )
  }

  if (mode === 'compact') {
    return (
      <aside className="ai-dock compact">
        <button type="button" className="ai-dock-handle" onClick={() => setMode('expanded')}>
          <div>
            <strong>AI Chat</strong>
            <span>{status?.model ?? 'gemma4'}</span>
          </div>
          <span>⌘J</span>
        </button>
        <button
          type="button"
          className="ai-dock-mini-toggle"
          onClick={() => setMode('hidden')}
          aria-label="AIチャットを非表示"
          title="非表示"
        >
          Hide
        </button>
      </aside>
    )
  }

  return (
    <aside className="ai-dock">
      <div className="ai-dock-header">
        <div>
          <div className="ai-dock-title">AI Chat Dock</div>
          <div className="ai-dock-subtitle">{subtitle}</div>
        </div>
        <div className="ai-dock-header-actions">
          <button type="button" className="ai-dock-header-button" onClick={() => setMode('compact')}>
            小さくする
          </button>
          <button type="button" className="ai-dock-close" onClick={() => setMode('hidden')}>
            ✕
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="ai-dock-log">
        {messages.length === 0 ? (
          <div className="ai-dock-empty">
            gemma4 に直接話しかけられます。Ctrl/Cmd + J でいつでも開けます。
          </div>
        ) : (
          messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`ai-bubble ${message.role}`}>
              <div className="ai-bubble-role">
                {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Gemma4' : 'System'}
              </div>
              <div className="ai-bubble-content">{message.content}</div>
            </article>
          ))
        )}
        {busy ? <div className="ai-dock-thinking">考え中...</div> : null}
      </div>

      <div className="ai-dock-form">
        <textarea
          ref={textareaRef}
          className="ai-dock-textarea"
          value={prompt}
          placeholder="gemma4 に聞きたいことを入力"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />

        <div className="ai-dock-button-row">
          <button type="button" className="ai-dock-button primary" onClick={submit} disabled={busy}>
            {busy ? '送信中...' : '送信'}
          </button>
          <button type="button" className="ai-dock-button" onClick={onRefreshStatus}>
            接続確認
          </button>
          <button type="button" className="ai-dock-button" onClick={onClear}>
            履歴クリア
          </button>
        </div>

        <div className="ai-dock-suggestions">
          {promptSuggestions.map((item) => (
            <button key={item} type="button" className="ai-chip" onClick={() => setPrompt(item)}>
              {item}
            </button>
          ))}
        </div>

        {error ? <div className="ai-dock-error">{error}</div> : null}

        <div className="ai-dock-meta">
          <span>Ctrl/Cmd + Enter で送信</span>
          <span>{prompt.trim().length} chars</span>
        </div>
      </div>
    </aside>
  )
}

export default AIChatDock
