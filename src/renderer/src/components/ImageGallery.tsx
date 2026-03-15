import { useEffect, useState } from 'react'
import { openOrDownloadImage } from '../gallery/imageDownload'
import type { GalleryItem } from '../gallery/types'
import './ImageGallery.css'

interface ImageGalleryProps {
  items: GalleryItem[]
  selectedItemId: string | null
  onSelect: (itemId: string | null) => void
  onDelete: (itemId: string) => void
  showRail?: boolean
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString()
}

function ImageGallery({
  items,
  selectedItemId,
  onSelect,
  onDelete,
  showRail = true
}: ImageGalleryProps): React.JSX.Element {
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const selectedIndex = items.findIndex((item) => item.id === selectedItemId)
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null

  useEffect(() => {
    if (!selectedItem) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onSelect(null)
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        const previous = items[selectedIndex - 1]
        if (previous) onSelect(previous.id)
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        const next = items[selectedIndex + 1]
        if (next) onSelect(next.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, onSelect, selectedIndex, selectedItem])

  return (
    <>
      {showRail ? (
        <aside className="gallery-rail" aria-label="Prompt gallery">
          <div className="gallery-rail-header">
            <span className="gallery-rail-title">Gallery</span>
            <span className="gallery-rail-count">{String(items.length).padStart(2, '0')}</span>
          </div>

          <div className="gallery-strip">
            {items.length === 0 ? (
              <div className="gallery-empty-card">
                <p className="gallery-empty-copy">
                  画像を追加するか、右下からプロンプトを保存してください。
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="gallery-card"
                  onClick={() => onSelect(item.id)}
                  title={item.prompt}
                >
                  <img src={item.imageUrl} alt={item.title} />
                  <div className="gallery-card-meta">
                    <span className="gallery-card-title">{item.title}</span>
                    <span className="gallery-card-subtitle">
                      {item.source === 'import' ? 'Imported' : item.style || 'Concept'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      ) : null}

      {selectedItem && (
        <div className="gallery-lightbox" onClick={() => onSelect(null)}>
          <div className="gallery-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="gallery-lightbox-stage">
              <img src={selectedItem.imageUrl} alt={selectedItem.title} />
              <div className="gallery-nav">
                <button
                  type="button"
                  className="gallery-nav-btn"
                  onClick={() => {
                    const previous = items[selectedIndex - 1]
                    if (previous) onSelect(previous.id)
                  }}
                  disabled={selectedIndex <= 0}
                  title="Previous"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="gallery-nav-btn"
                  onClick={() => {
                    const next = items[selectedIndex + 1]
                    if (next) onSelect(next.id)
                  }}
                  disabled={selectedIndex >= items.length - 1}
                  title="Next"
                >
                  →
                </button>
              </div>
            </div>

            <div className="gallery-lightbox-side">
              <div className="gallery-lightbox-header">
                <div>
                  <div className="gallery-lightbox-title">{selectedItem.title}</div>
                  <div className="gallery-lightbox-time">
                    {formatTimestamp(selectedItem.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="gallery-close-btn"
                  onClick={() => onSelect(null)}
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="gallery-lightbox-tags">
                <span className="gallery-tag">
                  {selectedItem.source === 'import' ? 'Imported image' : 'Prompt concept'}
                </span>
                {selectedItem.style ? (
                  <span className="gallery-tag">{selectedItem.style}</span>
                ) : null}
              </div>

              <div className="gallery-lightbox-prompt">{selectedItem.prompt}</div>

              <div className="gallery-lightbox-actions">
                <button
                  type="button"
                  className="gallery-action-btn"
                  onClick={async () => {
                    await window.api?.copyToClipboard?.(selectedItem.prompt)
                    setCopiedPromptId(selectedItem.id)
                    window.setTimeout(() => setCopiedPromptId(null), 1400)
                  }}
                >
                  {copiedPromptId === selectedItem.id ? 'Copied prompt' : 'Copy prompt'}
                </button>
                <button
                  type="button"
                  className="gallery-action-btn"
                  onClick={() => openOrDownloadImage(selectedItem)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="gallery-action-btn danger"
                  onClick={() => {
                    onDelete(selectedItem.id)
                    onSelect(null)
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ImageGallery
