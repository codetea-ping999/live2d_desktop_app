/**
 * Pure checks for the Electron security boundary (#16).
 */

/** Only these protocols may be handed to the OS via shell.openExternal. */
export const EXTERNAL_PROTOCOLS = new Set(['https:'])

export function isSafeExternalUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return EXTERNAL_PROTOCOLS.has(url.protocol) && url.username === '' && url.password === ''
}

export interface AppOrigin {
  /** Dev server URL (electron-vite), only set in development. */
  devServerUrl?: string | null
  /** file:// URL of the packaged renderer index.html. */
  rendererFileUrl: string
}

/**
 * True if `raw` is the app's own renderer page. Used to accept IPC only from
 * our frame and to block navigation anywhere else.
 */
export function isAppUrl(raw: string | null | undefined, origin: AppOrigin): boolean {
  if (!raw) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (origin.devServerUrl) {
    try {
      if (url.origin === new URL(origin.devServerUrl).origin) return true
    } catch {
      // ignore malformed dev URL
    }
  }
  const app = new URL(origin.rendererFileUrl)
  return url.protocol === 'file:' && url.pathname === app.pathname
}
