// Groups consecutive entries sharing the same label together, so "Marriage
// of: Ex 6:23" and "Children of: Ex 6:23, 25" render as labeled groups
// instead of a flat list — matching how Nave's own printed edition
// organizes a topic. Shared between the Topics page and the prayer
// grounding view (spec-amendment-v1-2 §B5, Layer 1), both of which render
// nave_topics rows the same way.
export function groupByLabel<T extends { label: string | null }>(entries: T[]): { label: string | null; refs: T[] }[] {
  const groups: { label: string | null; refs: T[] }[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.label === entry.label) {
      last.refs.push(entry)
    } else {
      groups.push({ label: entry.label, refs: [entry] })
    }
  }
  return groups
}
