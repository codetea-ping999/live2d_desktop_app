import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { MusicTrack, OllamaMessage, OllamaStatus } from '../../preload/index'
import AIChatDock from './components/AIChatDock'
import AudioDock from './components/AudioDock'
import ControlOverlay from './components/ControlOverlay'
import ImageDock from './components/ImageDock'
import ImageGallery from './components/ImageGallery'
import ImageSettingsPanel from './components/ImageSettingsPanel'
import Live2DViewer from './components/Live2DViewer'
import MusicSettingsPanel from './components/MusicSettingsPanel'
import SystemGauges from './components/SystemGauges'
import { defaultAppShortcuts, defaultTemplateShortcuts } from './config/shortcuts'
import { createPromptArtworkDataUrl, getPromptTitle } from './gallery/promptArtwork'
import type { GalleryItem } from './gallery/types'
import { chooseInitialModelId } from './repository/modelSelection'
import { loadSettings, saveSettings } from './settings/SettingsStore'
import { defaultSettings, type AppSettings, type MusicLoopMode } from './settings/types'

const GALLERY_STORAGE_KEY = 'live2d.gallery.v1'

function loadInitialGalleryItems(): GalleryItem[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(GALLERY_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as GalleryItem[]
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is GalleryItem =>
      Boolean(
        item &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.prompt === 'string' &&
        typeof item.imageUrl === 'string' &&
        typeof item.createdAt === 'number'
      )
    )
  } catch {
    return []
  }
}

function resolveProtocolValue(url: URL, queryKey = 'id'): string | null {
  const fromPath = decodeURIComponent(url.pathname.replace(/^\/+/, '')).trim()
  if (fromPath) return fromPath

  const fromQuery = url.searchParams.get(queryKey)?.trim()
  return fromQuery || null
}

function chooseInitialTrackId(
  preferredTrackId: string | null | undefined,
  tracks: MusicTrack[]
): string | null {
  if (preferredTrackId && tracks.some((track) => track.id === preferredTrackId)) {
    return preferredTrackId
  }

  return tracks[0]?.id ?? null
}

function getAdjacentTrackId(
  tracks: MusicTrack[],
  currentTrackId: string | null,
  direction: 'next' | 'previous',
  shuffle: boolean,
  allowWrap: boolean
): string | null {
  if (tracks.length === 0) return null
  if (tracks.length === 1) return tracks[0]?.id ?? null

  if (shuffle) {
    const filtered = tracks.filter((track) => track.id !== currentTrackId)
    if (filtered.length === 0) return currentTrackId
    const randomIndex = Math.floor(Math.random() * filtered.length)
    return filtered[randomIndex]?.id ?? null
  }

  const currentIndex = currentTrackId
    ? tracks.findIndex((track) => track.id === currentTrackId)
    : direction === 'next'
      ? -1
      : 0
  const offset = direction === 'next' ? 1 : -1
  const nextIndex = currentIndex + offset

  if (nextIndex >= 0 && nextIndex < tracks.length) {
    return tracks[nextIndex]?.id ?? null
  }

  if (!allowWrap) return null

  return direction === 'next' ? (tracks[0]?.id ?? null) : (tracks[tracks.length - 1]?.id ?? null)
}

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [modelPath, setModelPath] = useState<string | null>(null)
  const [modelStoragePath, setModelStoragePath] = useState<string>('')
  const [modelActionMessage, setModelActionMessage] = useState<string | null>(null)
  const [isImportingModel, setIsImportingModel] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(loadInitialGalleryItems)
  const [selectedGalleryItemId, setSelectedGalleryItemId] = useState<string | null>(null)
  const [isImageSettingsOpen, setIsImageSettingsOpen] = useState(false)
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [musicStoragePath, setMusicStoragePath] = useState<string>('')
  const [isMusicSettingsOpen, setIsMusicSettingsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [chatMessages, setChatMessages] = useState<OllamaMessage[]>([])
  const [isChatBusy, setIsChatBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tracksRef = useRef<MusicTrack[]>([])
  const settingsRef = useRef<AppSettings | null>(null)
  const selectTrackRef = useRef<(trackId: string | null, autoplay: boolean) => Promise<boolean>>(
    async () => false
  )

  const latestGalleryItem = galleryItems[0] ?? null
  const selectedGalleryItem = galleryItems.find((item) => item.id === selectedGalleryItemId) ?? null
  const currentTrack =
    tracks.find((track) => track.id === (settings?.musicCurrentTrackId ?? null)) ?? null
  const musicVolume = settings?.musicVolume ?? defaultSettings.musicVolume ?? 0.72
  const musicAutoplay = settings?.musicAutoplay ?? defaultSettings.musicAutoplay ?? false
  const musicShuffle = settings?.musicShuffle ?? defaultSettings.musicShuffle ?? false
  const musicLoopMode = settings?.musicLoopMode ?? defaultSettings.musicLoopMode ?? 'all'

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const persistGallery = useCallback((nextItems: GalleryItem[]) => {
    try {
      window.localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(nextItems))
    } catch {
      // ignore storage errors
    }
  }, [])

  const updateGallery = useCallback(
    (updater: (current: GalleryItem[]) => GalleryItem[]) => {
      startTransition(() => {
        setGalleryItems((current) => {
          const nextItems = updater(current).slice(0, 32)
          persistGallery(nextItems)
          return nextItems
        })
      })
    },
    [persistGallery]
  )

  const readFileAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('画像を読み込めませんでした。'))
      }
      reader.onerror = () => reject(reader.error ?? new Error('画像の読み込みに失敗しました。'))
      reader.readAsDataURL(file)
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      void saveSettings(next).catch(console.error)
      return next
    })
  }, [])

  const resolveModelPath = useCallback(async (modelId: string | null): Promise<string | null> => {
    if (!modelId) return null
    return (await window.api?.getModelEntry?.(modelId)) ?? null
  }, [])

  const refreshTracks = useCallback(async (): Promise<MusicTrack[]> => {
    const [nextTracks, nextStoragePath] = await Promise.all([
      window.api?.listTracks?.() ?? Promise.resolve([]),
      window.api?.getMusicStoragePath?.() ?? Promise.resolve('')
    ])

    setTracks(nextTracks)
    setMusicStoragePath(nextStoragePath)
    return nextTracks
  }, [])

  const loadTrackSource = useCallback(
    async (trackId: string | null, autoplay: boolean): Promise<boolean> => {
      const audio = audioRef.current
      if (!audio) return false

      if (!trackId) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        setIsPlaying(false)
        setCurrentTime(0)
        setDuration(0)
        return false
      }

      const entryUrl = await window.api?.getTrackEntry?.(trackId)
      if (!entryUrl) {
        setModelActionMessage('選択した音源を開けませんでした。')
        return false
      }

      const currentTrackKey = audio.dataset.trackId ?? null
      if (currentTrackKey !== trackId) {
        audio.dataset.trackId = trackId
        audio.src = entryUrl
        audio.load()
        setCurrentTime(0)
        setDuration(0)
      } else if (autoplay && audio.ended) {
        audio.currentTime = 0
        setCurrentTime(0)
      }

      if (!autoplay) return true

      try {
        await audio.play()
        return true
      } catch {
        setModelActionMessage('音楽の再生を開始できませんでした。')
        return false
      }
    },
    []
  )

  const selectTrack = useCallback(
    async (trackId: string | null, autoplay: boolean): Promise<boolean> => {
      updateSettings({ musicCurrentTrackId: trackId })
      return await loadTrackSource(trackId, autoplay)
    },
    [loadTrackSource, updateSettings]
  )

  useEffect(() => {
    selectTrackRef.current = selectTrack
  }, [selectTrack])

  const activateModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      const success = await window.api?.setModel?.(modelId)
      if (!success) {
        setModelActionMessage(`モデル "${modelId}" の切り替えに失敗しました。`)
        return false
      }

      const nextModelPath = await resolveModelPath(modelId)
      setModelPath(nextModelPath)
      updateSettings({ modelId })
      return true
    },
    [resolveModelPath, updateSettings]
  )

  const handleStepTrack = useCallback(
    async (direction: 'next' | 'previous', autoplay: boolean, allowWrap: boolean) => {
      const currentSettings = settingsRef.current
      const nextTrackId = getAdjacentTrackId(
        tracksRef.current,
        currentSettings?.musicCurrentTrackId ?? null,
        direction,
        currentSettings?.musicShuffle ?? false,
        allowWrap
      )

      if (!nextTrackId) {
        if (direction === 'next' && audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          setIsPlaying(false)
          setCurrentTime(0)
        }
        return false
      }

      return await selectTrack(nextTrackId, autoplay)
    },
    [selectTrack]
  )

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = defaultSettings.musicVolume ?? 0.72
    audioRef.current = audio

    const handlePlay = (): void => setIsPlaying(true)
    const handlePause = (): void => setIsPlaying(false)
    const handleTimeUpdate = (): void => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = (): void => setDuration(audio.duration)
    const handleDurationChange = (): void => setDuration(audio.duration)
    const handleEnded = (): void => {
      const currentSettings = settingsRef.current
      const currentTrackId = currentSettings?.musicCurrentTrackId ?? null
      if (!currentTrackId) return

      const loopMode = currentSettings?.musicLoopMode ?? defaultSettings.musicLoopMode ?? 'all'
      if (loopMode === 'one') {
        void selectTrackRef.current(currentTrackId, true)
        return
      }

      const allowWrap = loopMode === 'all'
      void handleStepTrack('next', true, allowWrap)
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audioRef.current = null
    }
  }, [handleStepTrack])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = musicVolume
  }, [musicVolume])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async (): Promise<void> => {
      try {
        const [loadedSettings, availableModels, storagePath, nextTracks, nextMusicStoragePath] =
          await Promise.all([
            loadSettings(),
            window.api?.listModels?.() ?? Promise.resolve([]),
            window.api?.getModelStoragePath?.() ?? Promise.resolve(''),
            window.api?.listTracks?.() ?? Promise.resolve([]),
            window.api?.getMusicStoragePath?.() ?? Promise.resolve('')
          ])

        if (cancelled) return

        const selectedModelId = chooseInitialModelId(loadedSettings.modelId, availableModels)
        const selectedTrackId = chooseInitialTrackId(loadedSettings.musicCurrentTrackId, nextTracks)
        const nextSettings =
          selectedModelId === loadedSettings.modelId &&
          selectedTrackId === (loadedSettings.musicCurrentTrackId ?? null)
            ? loadedSettings
            : {
                ...loadedSettings,
                modelId: selectedModelId,
                musicCurrentTrackId: selectedTrackId
              }

        if (
          nextSettings.modelId !== loadedSettings.modelId ||
          nextSettings.musicCurrentTrackId !== (loadedSettings.musicCurrentTrackId ?? null)
        ) {
          void saveSettings(nextSettings).catch(console.error)
        }

        const nextModelPath = await resolveModelPath(nextSettings.modelId)
        if (cancelled) return

        setTracks(nextTracks)
        setMusicStoragePath(nextMusicStoragePath)
        setModelStoragePath(storagePath)
        setModelPath(nextModelPath)
        setSettings(nextSettings)

        if (nextSettings.musicCurrentTrackId) {
          await loadTrackSource(
            nextSettings.musicCurrentTrackId,
            nextSettings.musicAutoplay ?? defaultSettings.musicAutoplay ?? false
          )
        }
      } catch {
        if (cancelled) return
        setSettings({ ...defaultSettings })
        setModelPath(null)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [loadTrackSource, resolveModelPath])

  useEffect(() => {
    const unsub = window.api?.onModelChanged?.((modelId: string | null) => {
      void (async () => {
        const nextModelPath = await resolveModelPath(modelId)
        setModelPath(nextModelPath)
      })()

      setSettings((prev) => (prev ? { ...prev, modelId } : prev))
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [resolveModelPath])

  useEffect(() => {
    const unsub = window.api?.onAppOpenedUrl?.((rawUrl: string) => {
      void (async () => {
        let parsedUrl: URL
        try {
          parsedUrl = new URL(rawUrl)
        } catch {
          setModelActionMessage(`URL を解釈できませんでした: ${rawUrl}`)
          return
        }

        const action = (parsedUrl.hostname || parsedUrl.pathname.replace(/^\/+/, '')).toLowerCase()

        switch (action) {
          case 'open':
            setModelActionMessage('アプリを前面表示しました。')
            return
          case 'model': {
            const modelId = resolveProtocolValue(parsedUrl)
            if (!modelId) {
              setModelActionMessage('モデル ID が指定されていません。')
              return
            }

            const changed = await activateModel(modelId)
            if (changed) {
              setModelActionMessage(`モデル "${modelId}" に切り替えました。`)
            }
            return
          }
          case 'motion': {
            const motionId = resolveProtocolValue(parsedUrl)
            if (!motionId) {
              setModelActionMessage('モーション ID が指定されていません。')
              return
            }

            window.__motionController?.playMotion(motionId, 10)
            setModelActionMessage(`モーション "${motionId}" を再生しました。`)
            return
          }
          case 'gauges': {
            const visibleParam = parsedUrl.searchParams.get('visible')?.toLowerCase()
            const visible =
              visibleParam == null ? true : ['1', 'true', 'on', 'yes'].includes(visibleParam)
            updateSettings({ systemGaugesVisible: visible })
            setModelActionMessage(
              visible ? 'システムゲージを表示しました。' : 'システムゲージを非表示にしました。'
            )
            return
          }
          case 'copy': {
            const text =
              parsedUrl.searchParams.get('text')?.trim() ?? resolveProtocolValue(parsedUrl, 'text')
            if (!text) {
              setModelActionMessage('コピーするテキストが指定されていません。')
              return
            }

            await window.api?.copyToClipboard?.(text)
            setModelActionMessage('テキストをクリップボードにコピーしました。')
            return
          }
          case 'gallery': {
            const itemId = resolveProtocolValue(parsedUrl)
            if (!itemId) {
              setModelActionMessage('ギャラリー項目 ID が指定されていません。')
              return
            }
            setSelectedGalleryItemId(itemId)
            return
          }
          default:
            setModelActionMessage(`未対応の URL 操作です: ${rawUrl}`)
        }
      })().catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        setModelActionMessage(message)
      })
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [activateModel, updateSettings])

  useEffect(() => {
    if (!modelActionMessage) return
    const timerId = window.setTimeout(() => setModelActionMessage(null), 4000)
    return () => window.clearTimeout(timerId)
  }, [modelActionMessage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isQuickFocus = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isQuickFocus) return
      event.preventDefault()
      setIsImageSettingsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleOpenModelFolder = useCallback(async () => {
    const result = await window.api?.openModelStoragePath?.()
    if (!result) {
      setModelActionMessage('モデル保存フォルダを開けませんでした。')
      return
    }

    setModelActionMessage(
      result.success
        ? 'モデル保存フォルダを開きました。'
        : (result.message ?? 'モデル保存フォルダを開けませんでした。')
    )
  }, [])

  const handleImportModel = useCallback(async () => {
    setIsImportingModel(true)
    const result = await window.api?.importModelDirectory?.()
    setIsImportingModel(false)

    if (!result) {
      setModelActionMessage('モデル取り込みに失敗しました。')
      return
    }

    setModelActionMessage(result.message ?? null)
    if (result.success && result.modelId) {
      await activateModel(result.modelId)
    }
  }, [activateModel])

  const handleCreatePromptImage = useCallback(
    (prompt: string, style: string) => {
      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) return

      const nextItem: GalleryItem = {
        id: `gallery-${Date.now()}`,
        title: getPromptTitle(trimmedPrompt),
        prompt: trimmedPrompt,
        imageUrl: createPromptArtworkDataUrl(trimmedPrompt, style),
        createdAt: Date.now(),
        source: 'mock',
        style
      }

      updateGallery((current) => [nextItem, ...current])
      setSelectedGalleryItemId(nextItem.id)
      setModelActionMessage('ギャラリーにプレビューを追加しました。')
    },
    [updateGallery]
  )

  const handleImportImages = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const importedItems = await Promise.all(
        Array.from(files).map(async (file, index) => {
          const imageUrl = await readFileAsDataUrl(file)
          return {
            id: `gallery-import-${Date.now()}-${index}`,
            title: file.name.replace(/\.[^.]+$/, '') || `Imported ${index + 1}`,
            prompt: `Imported image: ${file.name}`,
            imageUrl,
            createdAt: Date.now() + index,
            source: 'import' as const
          }
        })
      )

      updateGallery((current) => [...importedItems.reverse(), ...current])
      setSelectedGalleryItemId(importedItems[0]?.id ?? null)
      setModelActionMessage(`${importedItems.length} 枚の画像をギャラリーへ追加しました。`)
    },
    [readFileAsDataUrl, updateGallery]
  )

  const handleDeleteGalleryItem = useCallback(
    (itemId: string) => {
      updateGallery((current) => current.filter((item) => item.id !== itemId))
      if (selectedGalleryItem?.id === itemId) {
        setSelectedGalleryItemId(null)
      }
      setModelActionMessage('ギャラリーから画像を削除しました。')
    },
    [selectedGalleryItem?.id, updateGallery]
  )

  const handleTogglePlayPause = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
      return
    }

    const currentTrackId = settingsRef.current?.musicCurrentTrackId ?? null
    if (currentTrackId) {
      await loadTrackSource(currentTrackId, true)
      return
    }

    const firstTrackId = tracksRef.current[0]?.id ?? null
    if (!firstTrackId) {
      setModelActionMessage('再生できる音源がまだありません。')
      return
    }

    await selectTrack(firstTrackId, true)
  }, [loadTrackSource, selectTrack])

  const handlePreviousTrack = useCallback(async () => {
    if (tracksRef.current.length === 0) return
    await handleStepTrack('previous', true, true)
  }, [handleStepTrack])

  const handleNextTrack = useCallback(async () => {
    if (tracksRef.current.length === 0) return
    await handleStepTrack('next', true, true)
  }, [handleStepTrack])

  const handleImportMusic = useCallback(async () => {
    const result = await window.api?.importMusicFiles?.()
    if (!result) {
      setModelActionMessage('音源の取り込みに失敗しました。')
      return
    }

    const nextTracks = await refreshTracks()
    const currentTrackId = settingsRef.current?.musicCurrentTrackId ?? null
    const fallbackTrackId = chooseInitialTrackId(currentTrackId, nextTracks)

    if (fallbackTrackId !== currentTrackId) {
      await selectTrack(fallbackTrackId, false)
    }

    setModelActionMessage(result.message ?? '音源を取り込みました。')
  }, [refreshTracks, selectTrack])

  const handleOpenMusicFolder = useCallback(async () => {
    const result = await window.api?.openMusicStoragePath?.()
    if (!result) {
      setModelActionMessage('音源フォルダを開けませんでした。')
      return
    }

    setModelActionMessage(
      result.success
        ? '音源フォルダを開きました。'
        : (result.message ?? '音源フォルダを開けませんでした。')
    )
  }, [])

  const handleSelectTrack = useCallback(
    async (trackId: string) => {
      await selectTrack(trackId, true)
    },
    [selectTrack]
  )

  const handleMusicVolumeChange = useCallback(
    (volume: number) => updateSettings({ musicVolume: volume }),
    [updateSettings]
  )

  const handleMusicAutoplayChange = useCallback(
    (enabled: boolean) => updateSettings({ musicAutoplay: enabled }),
    [updateSettings]
  )

  const handleMusicShuffleChange = useCallback(
    (enabled: boolean) => updateSettings({ musicShuffle: enabled }),
    [updateSettings]
  )

  const handleMusicLoopModeChange = useCallback(
    (loopMode: MusicLoopMode) => updateSettings({ musicLoopMode: loopMode }),
    [updateSettings]
  )

  const refreshOllamaStatus = useCallback(async () => {
    try {
      const nextStatus = await window.api?.getOllamaStatus?.()
      setOllamaStatus(nextStatus ?? null)
      setChatError(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ollama の状態確認に失敗しました。'
      setChatError(message)
    }
  }, [])

  const handleSubmitChat = useCallback(
    async (prompt: string) => {
      const nextUserMessage: OllamaMessage = { role: 'user', content: prompt }
      const nextHistory = [...chatMessages, nextUserMessage]

      setChatMessages(nextHistory)
      setIsChatBusy(true)
      setChatError(null)

      try {
        const response = await window.api?.askOllama?.(prompt, chatMessages)
        if (!response) {
          throw new Error('Ollama から応答を受け取れませんでした。')
        }

        setChatMessages((current) => [
          ...current,
          { role: 'assistant', content: response.reply.trim() }
        ])
        setOllamaStatus((current) =>
          current ?? {
            baseUrl: response.baseUrl,
            model: response.model,
            availableModels: [response.model],
            modelAvailable: true
          }
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ollama との通信に失敗しました。'
        setChatError(message)
      } finally {
        setIsChatBusy(false)
      }
    },
    [chatMessages]
  )

  useEffect(() => {
    void refreshOllamaStatus()
  }, [refreshOllamaStatus])

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

  return (
    <div className="app-container">
      {modelPath ? (
        <Live2DViewer
          modelPath={modelPath}
          scale={settings.scale}
          opacity={settings.opacity}
          autoIdleEnabled={settings.autoIdleEnabled}
          autoIdleIntervalSec={settings.autoIdleIntervalSec}
        />
      ) : (
        <div className="empty-model-state">
          <p className="empty-model-title">モデルがまだ配置されていません</p>
          <p className="empty-model-copy">
            製品版ではライセンス未確定のキャラクターを同梱しない前提です。
          </p>
          <p className="empty-model-copy">Live2D モデル一式を配置する場所:</p>
          <code className="empty-model-path">{modelStoragePath || 'モデル保存先を確認中...'}</code>
          <div className="empty-model-actions">
            <button
              type="button"
              className="empty-model-btn"
              onClick={() => void handleOpenModelFolder()}
            >
              フォルダを開く
            </button>
            <button
              type="button"
              className="empty-model-btn primary"
              disabled={isImportingModel}
              onClick={() => void handleImportModel()}
            >
              {isImportingModel ? '取り込み中...' : 'モデルを取り込む'}
            </button>
          </div>
          {modelActionMessage && <p className="empty-model-feedback">{modelActionMessage}</p>}
        </div>
      )}

      <ControlOverlay
        scale={settings.scale}
        opacity={settings.opacity}
        currentModel={settings.modelId}
        autoIdleEnabled={settings.autoIdleEnabled ?? defaultSettings.autoIdleEnabled ?? true}
        autoIdleIntervalSec={
          settings.autoIdleIntervalSec ?? defaultSettings.autoIdleIntervalSec ?? 20
        }
        systemGaugesVisible={
          settings.systemGaugesVisible ?? defaultSettings.systemGaugesVisible ?? false
        }
        systemGaugeRefreshMs={
          settings.systemGaugeRefreshMs ?? defaultSettings.systemGaugeRefreshMs ?? 1000
        }
        appShortcuts={settings.appShortcuts ?? defaultAppShortcuts}
        templateShortcuts={settings.templateShortcuts ?? defaultTemplateShortcuts}
        onScaleChange={(scale) => updateSettings({ scale })}
        onOpacityChange={(opacity) => updateSettings({ opacity })}
        onAutoIdleChange={(autoIdleEnabled, autoIdleIntervalSec) =>
          updateSettings({ autoIdleEnabled, autoIdleIntervalSec })
        }
        onSystemGaugesChange={(systemGaugesVisible, systemGaugeRefreshMs) =>
          updateSettings({ systemGaugesVisible, systemGaugeRefreshMs })
        }
        onAppShortcutsChange={(appShortcuts) => updateSettings({ appShortcuts })}
        onTemplateShortcutsChange={(templateShortcuts) => updateSettings({ templateShortcuts })}
        onModelChange={(modelId) => {
          void activateModel(modelId)
        }}
      />

      <SystemGauges
        visible={settings.systemGaugesVisible ?? false}
        refreshIntervalMs={settings.systemGaugeRefreshMs ?? 1000}
        autoFreeEnabled={settings.autoFreeEnabled ?? false}
        autoFreeThreshold={settings.autoFreeThreshold ?? 85}
        onVisibilityChange={(visible) => updateSettings({ systemGaugesVisible: visible })}
        onRefreshIntervalChange={(refreshIntervalMs) =>
          updateSettings({ systemGaugeRefreshMs: refreshIntervalMs })
        }
        onAutoFreeChange={(autoFreeEnabled, autoFreeThreshold) =>
          updateSettings({ autoFreeEnabled, autoFreeThreshold })
        }
      />

      <ImageGallery
        items={galleryItems}
        selectedItemId={selectedGalleryItemId}
        onSelect={setSelectedGalleryItemId}
        onDelete={handleDeleteGalleryItem}
        showRail={false}
      />

      <ImageDock
        latestItem={latestGalleryItem}
        totalCount={galleryItems.length}
        onImportImages={handleImportImages}
        onOpenLatest={() => {
          if (latestGalleryItem) setSelectedGalleryItemId(latestGalleryItem.id)
          else setIsImageSettingsOpen(true)
        }}
        onOpenSettings={() => setIsImageSettingsOpen(true)}
      />

      <AIChatDock
        messages={chatMessages}
        busy={isChatBusy}
        error={chatError}
        onSubmit={(prompt) => void handleSubmitChat(prompt)}
        onClear={() => {
          setChatMessages([])
          setChatError(null)
        }}
        status={ollamaStatus}
        onRefreshStatus={() => void refreshOllamaStatus()}
      />

      <ImageSettingsPanel
        isOpen={isImageSettingsOpen}
        items={galleryItems}
        latestItem={latestGalleryItem}
        onClose={() => setIsImageSettingsOpen(false)}
        onCreatePromptImage={handleCreatePromptImage}
        onImportImages={handleImportImages}
        onOpenItem={setSelectedGalleryItemId}
        onDeleteItem={handleDeleteGalleryItem}
      />

      <AudioDock
        currentTrackTitle={currentTrack?.title ?? '音源を選択してください'}
        currentTrackSubtitle={
          currentTrack?.fileName ??
          (musicStoragePath
            ? `保存先: ${musicStoragePath}`
            : '音楽はいつでも詳細設定から追加できます。')
        }
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={musicVolume}
        onTogglePlayPause={() => void handleTogglePlayPause()}
        onNext={() => void handleNextTrack()}
        onPrevious={() => void handlePreviousTrack()}
        onVolumeChange={handleMusicVolumeChange}
        onOpenSettings={() => setIsMusicSettingsOpen(true)}
      />

      <MusicSettingsPanel
        isOpen={isMusicSettingsOpen}
        musicStoragePath={musicStoragePath}
        tracks={tracks}
        currentTrackId={settings.musicCurrentTrackId ?? null}
        volume={musicVolume}
        autoplay={musicAutoplay}
        shuffle={musicShuffle}
        loopMode={musicLoopMode}
        isPlaying={isPlaying}
        onClose={() => setIsMusicSettingsOpen(false)}
        onImportTracks={() => void handleImportMusic()}
        onOpenMusicFolder={() => void handleOpenMusicFolder()}
        onSelectTrack={(trackId) => void handleSelectTrack(trackId)}
        onVolumeChange={handleMusicVolumeChange}
        onAutoplayChange={handleMusicAutoplayChange}
        onShuffleChange={handleMusicShuffleChange}
        onLoopModeChange={handleMusicLoopModeChange}
        onTogglePlayPause={() => void handleTogglePlayPause()}
        onPrevious={() => void handlePreviousTrack()}
        onNext={() => void handleNextTrack()}
      />
    </div>
  )
}

export default App
