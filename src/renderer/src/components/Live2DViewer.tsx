import { useEffect, useRef, useCallback, useState } from 'react'
import { CursorInput } from '../input/CursorInput'
import { DragInput } from '../input/DragInput'
import { AvatarController } from '../core/AvatarController'
import { MotionController } from '../core/MotionController'
import { Live2DAdapter } from '../adapters/Live2DAdapter'

interface Live2DViewerProps {
  modelPath: string
  scale?: number
  opacity?: number
}

function Live2DViewer({
  modelPath,
  scale = 0.25,
  opacity = 1.0
}: Live2DViewerProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const adapterRef = useRef<Live2DAdapter | null>(null)
  const controllerRef = useRef<AvatarController | null>(null)
  const motionRef = useRef<MotionController | null>(null)
  const cursorInputRef = useRef<CursorInput | null>(null)
  const dragInputRef = useRef<DragInput | null>(null)
  const rafIdRef = useRef<number>(0)
  const idleTimerIdsRef = useRef<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const init = useCallback(async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const adapter = new Live2DAdapter(canvas, { scale, opacity })
    adapterRef.current = adapter

    const cursorInput = new CursorInput()
    cursorInputRef.current = cursorInput
    const controller = new AvatarController(cursorInput, { smoothing: true })
    controllerRef.current = controller

    const motionController = new MotionController((motionId) => adapter.playMotion(motionId))
    motionRef.current = motionController
    // motionRef を window にアクセス可能にしておく（UI からのモーション再生要求用）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__motionController = motionController

    const dragInput = new DragInput({
      hitTest: (x, y) => adapter.hitTest(x, y),
      onWindowMove: (x, y) => window.api?.moveWindow(x, y)
    })
    dragInputRef.current = dragInput

    try {
      setIsLoading(true)
      setError(null)
      console.log(`[Live2DViewer] Loading model from path: ${modelPath}`)
      await adapter.loadModel(modelPath)
      console.log('[Live2DViewer] Model loaded successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[Live2DViewer] Model loading failed:', message, err)
      setError(message)
      setIsLoading(false)
      return
    }

    adapter.setScale(scale)
    adapter.setOpacity(opacity)
    controller.start()
    dragInput.start()

    const tick = (): void => {
      const ctrl = controllerRef.current
      const adp = adapterRef.current
      if (ctrl && adp) adp.applyState(ctrl.getState())
      rafIdRef.current = requestAnimationFrame(tick)
    }
    rafIdRef.current = requestAnimationFrame(tick)

    // モデル外の透過部分ではマウスイベントを背後へ流す（設計書: window:set-ignore-mouse）
    const handleMouseMove = (e: MouseEvent): void => {
      const hitModel = adapter.hitTest(e.clientX, e.clientY)
      const overlayEl = document.querySelector('.control-overlay') as HTMLElement | null
      const panelEl = document.querySelector('.control-panel') as HTMLElement | null
      const isOnOverlay = (() => {
        const inRect = (el: HTMLElement | null): boolean => {
          if (!el) return false
          const r = el.getBoundingClientRect()
          return (
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom
          )
        }
        return inRect(overlayEl) || inRect(panelEl)
      })()
      window.api?.setIgnoreMouse(!(hitModel || isOnOverlay))
    }
    window.addEventListener('mousemove', handleMouseMove)

    // 部位クリックでモーション再生（制御レイヤーへ通知）
    const handleClick = (e: MouseEvent): void => {
      if (!adapter.hitTest(e.clientX, e.clientY)) return
      motionController.playMotion('Tap')
    }
    window.addEventListener('click', handleClick)

    setIsLoading(false)
    window.api?.setIgnoreMouse(true)

    // 自動アイドル再生の設定を取得してタイマーを設定
    try {
      const cfg = (await window.api?.getSettings?.()) as Record<string, any> | null
      const enabled = cfg?.autoIdleEnabled ?? true
      const intervalSec = cfg?.autoIdleIntervalSec ?? 20
      if (enabled && motionRef.current) {
        const idleLoop = async (): Promise<void> => {
          try {
            motionRef.current?.playMotion('Idle')
          } catch {
            // ignore
          }
          const jitter = Math.random() * 6 - 3 // ±3s jitter
          const next = Math.max(5, intervalSec + jitter)
          const id = window.setTimeout(idleLoop, next * 1000) as unknown as number
          idleTimerIdsRef.current.push(id)
        }
        const firstTimer = window.setTimeout(idleLoop, (intervalSec + Math.random() * 2) * 1000) as unknown as number
        idleTimerIdsRef.current.push(firstTimer)
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      cancelAnimationFrame(rafIdRef.current)
      controller.stop()
      dragInput.stop()
      adapter.destroy()
      adapterRef.current = null
      controllerRef.current = null
      motionRef.current = null
      cursorInputRef.current = null
      dragInputRef.current = null
      // clear idle timers
      for (const t of idleTimerIdsRef.current) {
        clearTimeout(t)
      }
      idleTimerIdsRef.current = []
    }
  }, [modelPath])

  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | undefined
    init().then((fn) => {
      if (disposed) {
        fn?.()
        return
      }
      cleanup = fn
    })
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [init])

  useEffect(() => {
    const adp = adapterRef.current
    if (adp) {
      adp.setScale(scale)
      adp.setOpacity(opacity)
    }
  }, [scale, opacity])

  return (
    <div className="live2d-container">
      <canvas ref={canvasRef} id="live2d-canvas" />
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading model...</p>
        </div>
      )}
      {error && (
        <div className="error-overlay">
          <p>⚠️ モデル読み込み失敗</p>
          <p className="error-details">{error}</p>
          <p className="error-hint">
            <strong>トラブルシューティング:</strong>
            <br />
            1) Cubism SDK Core: <code>src/renderer/public/lib/live2dcubismcore.min.js</code> が存在するか確認
            <br />
            2) モデルファイル: <code>src/renderer/models/miku/runtime/</code> に以下が存在するか確認:
            <br />
            - <code>miku.model3.json</code>
            <br />
            - <code>miku.moc3</code>
            <br />
            - <code>miku.physics3.json</code>
            <br />
            - <code>miku.cdi3.json</code>
            <br />
            - <code>miku.2048/texture_*.png</code>
            <br />
            - <code>motions/*.motion3.json</code>
            <br />
            3) ブラウザコンソール を開いて詳細なエラーを確認してください（Ctrl+Shift+I）
          </p>
        </div>
      )}
    </div>
  )
}

export default Live2DViewer
