import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { bindWindowEvents, IDLE_STATUS, type CharacterRuntime } from '../live2d/CharacterRuntime'
import { createPixiRuntime } from '../live2d/pixiRuntime'
import type { LoadResult, RuntimeStatus } from '../live2d/types'

interface Live2DViewerProps {
  /** Model entry URL; null shows nothing (e.g. empty library). */
  modelUrl: string | null
  scale: number
  opacity: number
  /** Called once per non-stale load, e.g. to roll back a failed selection. */
  onLoadResult?: (result: LoadResult) => void
}

const noopSubscribe = (): (() => void) => () => undefined
const idleStatus = (): RuntimeStatus => IDLE_STATUS

function Live2DViewer({
  modelUrl,
  scale,
  opacity,
  onLoadResult
}: Live2DViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [runtime, setRuntime] = useState<CharacterRuntime | null>(null)
  const latest = useRef({ scale, opacity, onLoadResult })

  useEffect(() => {
    latest.current = { scale, opacity, onLoadResult }
  })

  // Runtime lifetime == component lifetime. Created synchronously in the
  // effect so StrictMode's setup → cleanup → setup always pairs create/destroy.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const rt = createPixiRuntime(container, {
      initialScale: latest.current.scale,
      initialOpacity: latest.current.opacity
    })
    const unbind = bindWindowEvents(rt, window)
    setRuntime(rt)
    return () => {
      unbind()
      rt.destroy()
      setRuntime((current) => (current === rt ? null : current))
    }
  }, [])

  useEffect(() => {
    runtime?.setScale(scale)
  }, [runtime, scale])

  useEffect(() => {
    runtime?.setOpacity(opacity)
  }, [runtime, opacity])

  useEffect(() => {
    if (!runtime) return
    if (!modelUrl) {
      runtime.clear()
      return
    }
    void runtime.load(modelUrl).then((result) => {
      if (result.status !== 'stale') latest.current.onLoadResult?.(result)
    })
  }, [runtime, modelUrl])

  const status = useSyncExternalStore(
    runtime ? runtime.subscribe : noopSubscribe,
    runtime ? runtime.getStatus : idleStatus
  )

  const hasModel = status.currentUrl !== null

  return (
    <div className="live2d-container" ref={containerRef}>
      {status.phase === 'loading' && !hasModel && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading model...</p>
        </div>
      )}
      {status.phase === 'error' && !hasModel && (
        <div className="error-overlay">
          <p>⚠️ {status.error}</p>
          <p className="error-hint">
            Make sure the Cubism SDK core and model files are in place.
            <br />
            See README.md for setup instructions.
          </p>
        </div>
      )}
      {status.phase === 'error' && hasModel && (
        <div className="error-toast" role="alert">
          ⚠️ {status.error}
        </div>
      )}
    </div>
  )
}

export default Live2DViewer
