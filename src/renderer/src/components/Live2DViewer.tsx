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

    const dragInput = new DragInput({
      hitTest: (x, y) => adapter.hitTest(x, y),
      onWindowMove: (x, y) => window.api?.moveWindow(x, y)
    })
    dragInputRef.current = dragInput

    try {
      setIsLoading(true)
      setError(null)
      await adapter.loadModel(modelPath)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
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
      const hit = adapter.hitTest(e.clientX, e.clientY)
      window.api?.setIgnoreMouse(!hit)
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
    }
  }, [modelPath])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    init().then((fn) => {
      cleanup = fn
    })
    return () => {
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
          <p>⚠️ {error}</p>
          <p className="error-hint">
            1) Cubism SDK: <code>src/renderer/public/lib/live2dcubismcore.min.js</code> を配置
            <br />
            2) モデル: <code>src/renderer/models/miku/runtime/</code> に .model3.json, .moc3,
            テクスチャを配置
            <br />
            README.md のセットアップを確認してください。
          </p>
        </div>
      )}
    </div>
  )
}

export default Live2DViewer
