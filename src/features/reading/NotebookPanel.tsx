import type { NotebookSaveStatus } from './useNotebookEntry'

interface NotebookPanelProps {
  title: string
  onTitleChange: (title: string) => void
  body: string
  onBodyChange: (body: string) => void
  tagsInput: string
  onTagsChange: (tags: string) => void
  status: NotebookSaveStatus
  error: string | null
  onClose: () => void
}

const STATUS_LABEL: Record<NotebookSaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Could not save',
}

// Stays mounted for as long as notebookOpen is true in ReadingView --
// navigating between books/chapters doesn't unmount ReadingView, so this
// (and its autosaving draft, held in useNotebookEntry) survives that
// navigation for free.
export function NotebookPanel({
  title,
  onTitleChange,
  body,
  onBodyChange,
  tagsInput,
  onTagsChange,
  status,
  error,
  onClose,
}: NotebookPanelProps) {
  return (
    <div className="notebook-panel-inner">
      <div className="notebook-panel-header">
        <h2>Notebook</h2>
        <span className="notebook-status">{STATUS_LABEL[status]}</span>
        <button type="button" className="notebook-close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="notebook-hint">
        Autosaves as a journal entry while you write. Tag a verse anywhere with @Book chapter:verse — e.g. @Psa 46:10.
      </p>
      <input
        className="journal-title-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Title (optional)"
      />
      <textarea
        className="notebook-body-input"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Take notes here while you read, listen, or study…"
        autoFocus
      />
      <input
        className="journal-tags-input"
        value={tagsInput}
        onChange={(e) => onTagsChange(e.target.value)}
        placeholder="Topical tags, comma separated (optional)"
      />
      {error && <p className="error">{error}</p>}
    </div>
  )
}
