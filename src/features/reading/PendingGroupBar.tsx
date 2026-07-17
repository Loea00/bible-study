import type { HighlightColor } from '../../types/db'

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

interface PendingGroupBarProps {
  count: number
  editing?: boolean
  onHighlight: (color: HighlightColor) => Promise<void>
  onNote: () => void
  onClear: () => void
}

// Persistent bar shown while a "+ Add" group is being built (spec amendment
// v1.1 §A9) — stays visible across selections so the user can keep adding
// non-consecutive spans before committing them as one highlight/note. Also
// reused for extending an existing highlight (see ReadingView's
// startEditHighlight) — `editing` just changes the label and Clear's
// implied meaning (cancel the edit, not just clear a fresh selection).
export function PendingGroupBar({ count, editing, onHighlight, onNote, onClear }: PendingGroupBarProps) {
  return (
    <div className="pending-bar">
      <span className="pending-bar-count">
        {editing ? `Extending highlight — ${count} span${count === 1 ? '' : 's'}` : `${count} selected`}
      </span>
      <div className="selection-bar-swatches">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`highlight-swatch highlight-swatch-${color}`}
            aria-label={`Highlight ${color}`}
            onClick={() => onHighlight(color)}
          />
        ))}
      </div>
      <div className="selection-bar-divider" />
      <button type="button" className="selection-bar-action" onClick={onNote}>
        Note
      </button>
      <button type="button" className="selection-bar-action" onClick={onClear}>
        {editing ? 'Cancel' : 'Clear'}
      </button>
    </div>
  )
}
