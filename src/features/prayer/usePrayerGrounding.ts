import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { NaveTopic } from '../../types/db'

// Layer 1 of the prayer tracker's scriptural-grounding design
// (spec-amendment-v1-2 §B5) — free, offline topic-to-verse matching via
// Nave's Topical Bible, no AI call. Deliberately doesn't touch
// prayer_requests.grounding/grounding_generated_at — those columns are
// reserved for Layer 2's cached AI output; this is a pure client-side
// lookup, computed fresh each time, nothing written back to the request.
//
// Matches per-keyword via search_nave_topics (the same RPC the Topics page
// uses for its search-as-you-type) rather than fetching the full topic
// list once and matching client-side — PostgREST's default 1000-row cap
// silently truncates a full-list fetch to roughly the first third of the
// ~5,000 topics alphabetically, which would make anything from "T" onward
// (including common ones like "Wisdom") unreachable.

// Generic stopwords, plus common prayer-address/filler words ("Lord",
// "help", "please", "want", "gave") that are frequent enough in *any*
// prayer to swamp the actual subject if left in — "Lord, help me..."
// shouldn't surface the LORD topic every single time.
const STOPWORDS = new Set([
  'that',
  'this',
  'with',
  'from',
  'have',
  'will',
  'your',
  'about',
  'please',
  'some',
  'they',
  'them',
  'then',
  'when',
  'what',
  'where',
  'into',
  'over',
  'also',
  'just',
  'more',
  'very',
  'their',
  'there',
  'been',
  'were',
  'would',
  'could',
  'should',
  'these',
  'those',
  'which',
  'lord',
  'god',
  'jesus',
  'christ',
  'help',
  'want',
  'wish',
  'gave',
  'given',
  'give',
  'pray',
  'praying',
  'prayer',
  'thank',
  'thanks',
  'amen',
  'dear',
])

// No cap on real-world prayer text — the earlier cap of 8 sliced by
// document order, which silently dropped the most specific words in any
// request longer than a sentence (they tend to come later, after the
// address to God and the generic "help me" opener). A high ceiling just
// guards against something pathological, not normal prayer text.
const MAX_KEYWORDS = 40

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  return [...new Set(words)].slice(0, MAX_KEYWORDS)
}

// Naive singular/plural fold ("pain" ~ "pains") — good enough for this
// offline heuristic, not real stemming.
function stem(word: string): string {
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word
}

function isWholeWordMatch(keyword: string, topic: string): boolean {
  const topicWords = topic.toLowerCase().split(/[\s,]+/)
  return topicWords.some((w) => stem(w) === stem(keyword))
}

// search_nave_topics does a plain substring ilike server-side (same as the
// Topics page's own search), which is enough to fetch a small candidate
// set per keyword but too loose to trust directly — "body" would substring
// -match "BUSYBODY". Each keyword's candidates get filtered down here to
// only topics that actually contain that keyword as a whole word, then
// tallied across keywords so multi-keyword matches rank first.
async function findMatchingTopics(keywords: string[], limit: number): Promise<string[]> {
  const scores = new Map<string, number>()
  await Promise.all(
    keywords.map(async (kw) => {
      const { data, error } = await supabase.rpc('search_nave_topics', { query: kw, max_results: 20 })
      if (error || !data) return
      for (const row of data) {
        if (isWholeWordMatch(kw, row.topic)) {
          scores.set(row.topic, (scores.get(row.topic) ?? 0) + 1)
        }
      }
    }),
  )
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic)
}

export interface PrayerGroundingGroup {
  topic: string
  entries: NaveTopic[]
}

export function usePrayerGrounding() {
  const [groups, setGroups] = useState<PrayerGroundingGroup[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(title: string, description: string) {
    setLoading(true)
    setError(null)
    try {
      const keywords = extractKeywords(`${title} ${description}`)
      const matched = keywords.length > 0 ? await findMatchingTopics(keywords, 5) : []

      if (matched.length === 0) {
        setGroups([])
        return
      }

      const { data, error: queryError } = await supabase.from('nave_topics').select('*').in('topic', matched)
      if (queryError) throw new Error(queryError.message)

      const byTopic = new Map<string, NaveTopic[]>()
      for (const row of data ?? []) {
        const bucket = byTopic.get(row.topic)
        if (bucket) bucket.push(row)
        else byTopic.set(row.topic, [row])
      }
      setGroups(matched.map((topic) => ({ topic, entries: byTopic.get(topic) ?? [] })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load related Scripture.')
    } finally {
      setLoading(false)
    }
  }

  return { groups, loading, error, load }
}
