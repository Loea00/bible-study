import { useMemo, useState } from 'react'
import { usePrayerLists } from './usePrayerLists'
import { usePrayerRequests } from './usePrayerRequests'
import { usePrayedMarks } from './usePrayedMarks'
import { PrayerRequestCard } from './PrayerRequestCard'
import { PrayThroughFlow } from './PrayThroughFlow'
import type { PrayedMark, PrayerRequest, PrayerRequestStatus } from '../../types/db'

type StatusFilter = 'open' | 'answered' | 'archived' | 'all'

function matchesFilter(status: PrayerRequestStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return status === 'active' || status === 'ongoing'
  return status === filter
}

// Never-prayed-for requests sort first (spec §B3's "requests you haven't
// touched lately," applied gently as ordering rather than a guilt nudge).
function sortForPrayThrough(items: PrayerRequest[], marksByRequest: Record<string, PrayedMark[]>): PrayerRequest[] {
  function lastPrayedAt(r: PrayerRequest): number {
    const marks = marksByRequest[r.id]
    return marks && marks.length > 0 ? new Date(marks[0].created_at).getTime() : -Infinity
  }
  return [...items].sort((a, b) => lastPrayedAt(a) - lastPrayedAt(b))
}

export function PrayerPage() {
  const { lists, loading: listsLoading, createList, renameList, deleteList } = usePrayerLists()
  const { requests, loading: requestsLoading, createRequest, updateRequest, markAnswered, setStatus, deleteRequest } =
    usePrayerRequests()
  const { marksByRequest, addMark } = usePrayedMarks()

  const [prayThrough, setPrayThrough] = useState<{ name: string; requests: PrayerRequest[] } | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newListId, setNewListId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [renamingListId, setRenamingListId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [filter, setFilter] = useState<StatusFilter>('open')

  const loading = listsLoading || requestsLoading

  async function handleCreateRequest() {
    if (!newTitle.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await createRequest(newTitle, newDescription, newListId || null)
      setNewTitle('')
      setNewDescription('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not save the request.')
    } finally {
      setCreating(false)
    }
  }

  async function handleAddList() {
    if (!newListName.trim()) return
    await createList(newListName)
    setNewListName('')
    setAddingList(false)
  }

  async function handleRenameList(listId: string) {
    if (!renameValue.trim()) return
    await renameList(listId, renameValue)
    setRenamingListId(null)
  }

  const grouped = useMemo(() => {
    const filtered = requests.filter((r) => matchesFilter(r.status, filter))
    const byList = new Map<string, typeof filtered>()
    for (const r of filtered) {
      const key = r.list_id ?? 'unlisted'
      const bucket = byList.get(key)
      if (bucket) bucket.push(r)
      else byList.set(key, [r])
    }
    return byList
  }, [requests, filter])

  const hasAnyVisible = [...grouped.values()].some((v) => v.length > 0)

  // Independent of the status filter above — "pray through" only ever
  // touches open requests, so it stays available even while viewing the
  // Answered or Archived filter.
  const openByList = useMemo(() => {
    const byList = new Map<string, PrayerRequest[]>()
    for (const r of requests) {
      if (r.status !== 'active' && r.status !== 'ongoing') continue
      const key = r.list_id ?? 'unlisted'
      const bucket = byList.get(key)
      if (bucket) bucket.push(r)
      else byList.set(key, [r])
    }
    return byList
  }, [requests])

  const hasAnyOpen = [...openByList.values()].some((v) => v.length > 0)

  function startPrayThrough(key: string, name: string) {
    setPrayThrough({ name, requests: sortForPrayThrough(openByList.get(key) ?? [], marksByRequest) })
  }

  if (prayThrough) {
    return (
      <div className="prayer-page">
        <PrayThroughFlow
          listName={prayThrough.name}
          requests={prayThrough.requests}
          onMark={addMark}
          onExit={() => setPrayThrough(null)}
        />
      </div>
    )
  }

  return (
    <div className="prayer-page">
      <div className="journal-editor">
        <input
          className="journal-title-input"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="What are you praying for?"
        />
        <textarea
          className="journal-body-input"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          rows={3}
          placeholder="Details (optional)"
        />
        <select className="prayer-list-select" value={newListId} onChange={(e) => setNewListId(e.target.value)}>
          <option value="">Unlisted</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleCreateRequest} disabled={creating || !newTitle.trim()}>
          {creating ? 'Saving…' : 'Add to prayer list'}
        </button>
        {createError && <p className="error">{createError}</p>}
      </div>

      <div className="prayer-lists-bar">
        {lists.map((l) =>
          renamingListId === l.id ? (
            <span key={l.id} className="prayer-list-pill prayer-list-pill-editing">
              <input
                className="prayer-list-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={() => handleRenameList(l.id)}>
                Save
              </button>
              <button type="button" onClick={() => setRenamingListId(null)}>
                Cancel
              </button>
            </span>
          ) : (
            <span key={l.id} className="prayer-list-pill">
              {l.name}
              <button
                type="button"
                className="prayer-list-pill-action"
                onClick={() => {
                  setRenamingListId(l.id)
                  setRenameValue(l.name)
                }}
              >
                Rename
              </button>
              <button type="button" className="prayer-list-pill-action" onClick={() => deleteList(l.id)}>
                Delete
              </button>
            </span>
          ),
        )}
        {addingList ? (
          <span className="prayer-list-pill prayer-list-pill-editing">
            <input
              className="prayer-list-rename-input"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              autoFocus
            />
            <button type="button" onClick={handleAddList}>
              Add
            </button>
            <button type="button" onClick={() => setAddingList(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="prayer-list-add" onClick={() => setAddingList(true)}>
            + New list
          </button>
        )}
      </div>

      {hasAnyOpen && (
        <div className="prayer-through-bar">
          {lists.map((l) => {
            const open = openByList.get(l.id) ?? []
            if (open.length === 0) return null
            return (
              <button
                key={l.id}
                type="button"
                className="prayer-through-button"
                onClick={() => startPrayThrough(l.id, l.name)}
              >
                Pray through {l.name} ({open.length})
              </button>
            )
          })}
          {(() => {
            const open = openByList.get('unlisted') ?? []
            if (open.length === 0) return null
            return (
              <button type="button" className="prayer-through-button" onClick={() => startPrayThrough('unlisted', 'Unlisted')}>
                Pray through Unlisted ({open.length})
              </button>
            )
          })()}
        </div>
      )}

      <div className="journal-type-filters">
        {(['open', 'answered', 'archived', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`journal-type-filter${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'open' ? 'Open' : f === 'answered' ? 'Answered' : f === 'archived' ? 'Archived' : 'All'}
          </button>
        ))}
      </div>

      {loading && <p className="placeholder">Loading…</p>}
      {!loading && requests.length === 0 && (
        <p className="placeholder">Nothing here yet — add your first prayer request above.</p>
      )}
      {!loading && requests.length > 0 && !hasAnyVisible && <p className="placeholder">Nothing matches this filter.</p>}

      <div className="prayer-groups">
        {lists.map((l) => {
          const items = grouped.get(l.id)
          if (!items || items.length === 0) return null
          return (
            <div key={l.id} className="prayer-group">
              <h2 className="prayer-group-title">{l.name}</h2>
              <div className="journal-timeline">
                {items.map((r) => (
                  <PrayerRequestCard
                    key={r.id}
                    request={r}
                    lists={lists}
                    marks={marksByRequest[r.id] ?? []}
                    onEdit={updateRequest}
                    onSetStatus={setStatus}
                    onMarkAnswered={markAnswered}
                    onMarkPrayed={addMark}
                    onDelete={deleteRequest}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {(() => {
          const items = grouped.get('unlisted')
          if (!items || items.length === 0) return null
          return (
            <div className="prayer-group">
              <h2 className="prayer-group-title">Unlisted</h2>
              <div className="journal-timeline">
                {items.map((r) => (
                  <PrayerRequestCard
                    key={r.id}
                    request={r}
                    lists={lists}
                    marks={marksByRequest[r.id] ?? []}
                    onEdit={updateRequest}
                    onSetStatus={setStatus}
                    onMarkAnswered={markAnswered}
                    onMarkPrayed={addMark}
                    onDelete={deleteRequest}
                  />
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
