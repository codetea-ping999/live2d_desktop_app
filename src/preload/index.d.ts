import type { Live2DAPI } from '../shared/ipc'

declare global {
  interface Window {
    api: Live2DAPI
  }
}
