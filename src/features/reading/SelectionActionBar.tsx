import { useState } from 'react'
import type { HighlightColor } from '../../types/db'

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

interface SelectionActionBarProps {
  rect: DOMRect
  selectedText: string
  onHighlight: (color: HighlightColor) => Promise<void>
  onNote: () => void
  onClose: () => void
}

// Reflect and Ask aren't built yet (reflection mode + AI assistant are
// later Phase 2/3 surfaces), so the action bar is Highlight/Note/Copy only
// for now — not the full spec 5.1 selection-action set.
export function SelectionActionBar({ rect, selectedText, onHighlight, onNote, onClose }: SelectionActionBarProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleHighlight(color: HighlightColor) {
    setError(null)
    try {
      await onHighlight(color)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the highlight.')
    }
  }

  async function handleCopy() {
    setError(null)
    try {
      await navigator.clipboard.writeText(selectedText)
      setCopied(true)
      setTimeout(() => onClose(), 600)
    } catch {
      // Clipboard access can be denied by the browser/OS (permissions,
      // insecure context, automation sandboxes) — surface it instead of
      // leaving the button silently inert.
      setError('Could not copy — clipboard access was denied.')
    }
  }

  // Fixed, not absolute: getBoundingClientRect() is already viewport-relative,
  // matching what `fixed` positioning expects directly.
  const top = rect.top - 56
  const left = rect.left + rect.width / 2

  return (
    <div className="selection-bar" style={{ top, left }}>
      <div className="selection-bar-swatches">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`highlight-swatch highlight-swatch-${color}`}
            aria-label={`Highlight ${color}`}
            onClick={() => handleHighlight(color)}
          />
        ))}
      </div>
      <div className="selection-bar-divider" />
      <button type="button" className="selection-bar-action" onClick={onNote}>
        Note
      </button>
      <button type="button" className="selection-bar-action" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
