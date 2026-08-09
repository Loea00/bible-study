import { useState } from 'react'

export type InputPosition = 'top' | 'bottom'

// Per-page preference for where a doorway's "new entry" input card sits —
// deliberately per-surface (not a single global setting), stored under a
// caller-supplied key so Journal and Prayer remember their own choice
// independently. localStorage only: this is a display preference, not an
// artifact, so it doesn't need to sync across devices via Supabase.
export function useInputPosition(storageKey: string): [InputPosition, (position: InputPosition) => void] {
  const [position, setPositionState] = useState<InputPosition>(() => {
    return localStorage.getItem(storageKey) === 'bottom' ? 'bottom' : 'top'
  })

  function setPosition(next: InputPosition) {
    setPositionState(next)
    localStorage.setItem(storageKey, next)
  }

  return [position, setPosition]
}
