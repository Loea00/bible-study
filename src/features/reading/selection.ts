export interface SelectionSpan {
  verseId: string
  startOffset: number
  endOffset: number
}

// Character offset of (node, offset) within the concatenated text content
// of `root`, walking in document order. Used to translate a browser
// Range's boundary (which points at a specific DOM text node) back into a
// plain-text offset comparable to the canonical verse text from the
// database — never trust offsets computed against the DOM directly, since
// word-tap <span> wrapping would otherwise throw them off.
function textOffsetWithin(root: Node, node: Node, offset: number): number {
  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset
    total += (current.textContent ?? '').length
  }
  return total
}

// Reads the current native selection and maps it onto one span per verse
// it touches (per spec amendment v1.1 §A9: a selection crossing verse
// boundaries yields one span per verse). Returns [] for a collapsed
// selection (i.e. a plain click, not a drag).
export function getSelectionSpans(): SelectionSpan[] {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return []
  const range = sel.getRangeAt(0)

  const verseEls = document.querySelectorAll<HTMLElement>('[data-verse-content]')
  const spans: SelectionSpan[] = []

  verseEls.forEach((el) => {
    if (!range.intersectsNode(el)) return
    const verseId = el.dataset.verseContent
    if (!verseId) return

    const fullLength = (el.textContent ?? '').length
    const startsInside = el.contains(range.startContainer)
    const endsInside = el.contains(range.endContainer)

    const start = startsInside ? textOffsetWithin(el, range.startContainer, range.startOffset) : 0
    const end = endsInside ? textOffsetWithin(el, range.endContainer, range.endOffset) : fullLength

    if (end > start) {
      spans.push({ verseId, startOffset: start, endOffset: end })
    }
  })

  return spans
}

export function getSelectionBoundingRect(): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return sel.getRangeAt(0).getBoundingClientRect()
}

export function clearSelection() {
  window.getSelection()?.removeAllRanges()
}
