import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { bindWindowEvents, IDLE_STATUS, type CharacterRuntime } from '../live2d/CharacterRuntime'
import { createPixiRuntime } from '../live2d/pixiRuntime'
import { PointerGesture, type PointerPoint } from '../live2d/pointerGesture'
import type { LoadResult, RuntimeStatus } from '../live2d/types'

interface Live2DViewerProps {
  /** Model entry URL; null shows nothing (e.g. empty library). */
  modelUrl: string | null
  scale: number
  opacity: number
  /** False in click-through mode: no drag / tap handling. */
  interactive: boolean
  /** Called once per non-stale load, e.g. to roll back a failed selection. */
  onLoadResult?: (result: LoadResult) => void
}

function screenOf(p: PointerPoint): { screenX: number; screenY: number } {
  return { screenX: p.screenX, screenY: p.screenY }
}

const noopSubscribe = (): (() => void) => () => undefined
const idleStatus = (): RuntimeStatus => IDLE_STATUS

function Live2DViewer({
  modelUrl,
  scale,
  opacity,
  interactive,
  onLoadResult
}: Live2DViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [runtime, setRuntime] = useState<CharacterRuntime | null>(null)
  const latest = useRef({ scale, opacity, onLoadResult })
  const gesture = useRef(new PointerGesture())
  const [dragging, setDragging] = useState(false)

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

  // Drag on the character moves the window; a short click is a tap (#3).
  const point = (e: React.PointerEvent): PointerPoint => ({
    clientX: e.clientX,
    clientY: e.clientY,
    screenX: e.screenX,
    screenY: e.screenY
  })

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!interactive || e.button !== 0 || !runtime) return
    if (!runtime.containsPoint(e.clientX, e.clientY)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current.down(point(e))
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const event = gesture.current.move(point(e))
    if (!event) return
    if (event.type === 'drag-start') {
      setDragging(true)
      window.api.drag({ phase: 'start', ...screenOf(event.origin) })
      window.api.drag({ phase: 'move', ...screenOf(event.current) })
    } else if (event.type === 'drag-move') {
      window.api.drag({ phase: 'move', ...screenOf(event.current) })
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const event = gesture.current.up(point(e))
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (event?.type === 'drag-end') {
      setDragging(false)
      window.api.drag({ phase: 'end', ...screenOf(event.current) })
    } else if (event?.type === 'tap') {
      runtime?.tap(event.at.clientX, event.at.clientY)
    }
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>): void => {
    const event = gesture.current.cancel(point(e))
    if (event?.type === 'drag-end') {
      setDragging(false)
      window.api.drag({ phase: 'end', ...screenOf(event.current) })
    }
  }

  return (
    <div
      className={`live2d-container ${dragging ? 'dragging' : ''}`}
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
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
