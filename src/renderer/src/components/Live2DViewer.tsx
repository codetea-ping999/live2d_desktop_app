import { useEffect, useRef, useCallback, useState } from 'react'
import * as PIXI from 'pixi.js'

// Import pixi-live2d-display for both Cubism 2 and 4
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Live2DModel } = require('pixi-live2d-display/cubism4');
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('pixi-live2d-display/cubism2'); // Register Cubism 2 support

// Register PixiJS ticker for Live2D animation updates
Live2DModel.registerTicker(PIXI.Ticker)

interface Live2DViewerProps {
    modelPath: string
    scale?: number
    opacity?: number
}

function Live2DViewer({ modelPath, scale = 0.25, opacity = 1.0 }: Live2DViewerProps): React.JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const appRef = useRef<PIXI.Application | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelRef = useRef<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const initPixi = useCallback(async (): Promise<(() => void) | undefined> => {
        if (!canvasRef.current) return undefined

        try {
            // Create PixiJS application with transparent background
            const app = new PIXI.Application({
                view: canvasRef.current,
                backgroundAlpha: 0,
                resizeTo: window,
                antialias: true,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1
            })
            appRef.current = app

            // Load the Live2D model
            setIsLoading(true)
            setError(null)

            const model = await Live2DModel.from(modelPath, {
                autoInteract: false // We'll handle interaction manually
            })

            modelRef.current = model
            app.stage.addChild(model)

            // Scale and position the model
            const updateModelTransform = (): void => {
                if (!model) return
                model.scale.set(scale)

                // Center the model horizontally, position at bottom
                const modelWidth = model.width
                const modelHeight = model.height
                model.x = (window.innerWidth - modelWidth) / 2
                model.y = window.innerHeight - modelHeight
            }

            updateModelTransform()

            // Handle window resize
            window.addEventListener('resize', updateModelTransform)

            // Mouse tracking — make the model watch the cursor
            const handleMouseMove = (e: MouseEvent): void => {
                if (model?.internalModel) {
                    model.focus(e.clientX, e.clientY)
                }
            }
            window.addEventListener('mousemove', handleMouseMove)

            // Click interaction — tap triggers a motion
            model.on('hit', (hitAreas: string[]) => {
                if (hitAreas.includes('Body')) {
                    model.motion('TapBody')
                } else if (hitAreas.includes('Head')) {
                    model.expression()
                }
            })

            setIsLoading(false)

            // Cleanup function stored for later
            return (): void => {
                window.removeEventListener('resize', updateModelTransform)
                window.removeEventListener('mousemove', handleMouseMove)
            }
        } catch (err) {
            console.error('Failed to load Live2D model:', err)
            setError(err instanceof Error ? err.message : 'Failed to load model')
            setIsLoading(false)
            return undefined
        }
    }, [modelPath])

    // Update scale when prop changes
    useEffect(() => {
        if (modelRef.current) {
            modelRef.current.scale.set(scale)
            const modelWidth = modelRef.current.width
            const modelHeight = modelRef.current.height
            modelRef.current.x = (window.innerWidth - modelWidth) / 2
            modelRef.current.y = window.innerHeight - modelHeight
        }
    }, [scale])

    // Update opacity when prop changes
    useEffect(() => {
        if (modelRef.current) {
            modelRef.current.alpha = opacity
        }
    }, [opacity])

    useEffect(() => {
        let cleanup: (() => void) | undefined

        initPixi().then((cleanupFn) => {
            cleanup = cleanupFn
        })

        return (): void => {
            cleanup?.()
            if (appRef.current) {
                appRef.current.destroy(true, { children: true, texture: true })
                appRef.current = null
            }
        }
    }, [initPixi])

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
                        Make sure the Cubism SDK core and model files are in place.
                        <br />
                        See README.md for setup instructions.
                    </p>
                </div>
            )}
        </div>
    )
}

export default Live2DViewer
