import { useState } from 'react'
import type { HighlightColor } from '../../types/db'

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

interface SelectionActionBarProps {
  rect: DOMRect
  selectedText: string
  groupCount: number
  onHighlight: (color: HighlightColor) => Promise<void>
  onNote: () => void
  onReflect: () => void
  onAddToGroup: () => void
  onClose: () => void
}

// Ask (AI) isn't built yet (that's a later Phase 3 surface), so the action
// bar is Highlight/Note/Reflect/Copy/+Add — not the full spec 5.1 set.
export function SelectionActionBar({
  rect,
  selectedText,
  groupCount,
  onHighlight,
  onNote,
  onReflect,
  onAddToGroup,
  onClose,
}: SelectionActionBarProps) {
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
        {groupCount > 0 ? `Note (${groupCount + 1})` : 'Note'}
      </button>
      <button type="button" className="selection-bar-action" onClick={onReflect}>
        Reflect
      </button>
      <button type="button" className="selection-bar-action" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button type="button" className="selection-bar-action" onClick={onAddToGroup}>
        + Add
      </button>
      <button type="button" className="selection-bar-close" aria-label="Dismiss" onClick={onClose}>
        ×
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
