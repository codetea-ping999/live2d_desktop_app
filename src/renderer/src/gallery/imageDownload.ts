import type { GalleryItem } from './types'

export function getDownloadExtension(imageUrl: string): string {
  const match = imageUrl.match(/^data:image\/([a-z0-9.+-]+);/i)
  const subtype = match?.[1]?.toLowerCase()

  if (!subtype) return 'png'
  if (subtype === 'jpeg') return 'jpg'
  if (subtype.includes('svg')) return 'svg'
  return subtype
}

export function toDownloadFileName(title: string, imageUrl: string): string {
  const safeTitle = title
    .trim()
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0)
      if (code <= 31) return '-'
      if ('<>:"/\\|?*'.includes(character)) return '-'
      return character
    })
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const baseName = safeTitle || 'gallery-image'
  return `${baseName}.${getDownloadExtension(imageUrl)}`
}

export function openOrDownloadImage(item: GalleryItem): void {
  if (/^https?:\/\//i.test(item.imageUrl)) {
    window.open(item.imageUrl, '_blank', 'noopener,noreferrer')
    return
  }

  const link = document.createElement('a')
  link.href = item.imageUrl
  link.download = toDownloadFileName(item.title, item.imageUrl)
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}
