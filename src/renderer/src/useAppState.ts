import { useEffect, useState } from 'react'
import type { AppStateView } from '../../shared/ipc'

/** App state owned by the main process; null until the first answer arrives. */
export function useAppState(): AppStateView | null {
  const [state, setState] = useState<AppStateView | null>(null)

  useEffect(() => {
    let active = true
    const unsubscribe = window.api.onStateChanged((next) => {
      if (active) setState(next)
    })
    window.api
      .getState()
      .then((initial) => {
        if (active) setState((current) => current ?? initial)
      })
      .catch((error) => console.error('Failed to read app state:', error))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return state
}
