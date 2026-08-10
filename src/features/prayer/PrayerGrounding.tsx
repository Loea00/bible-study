import { Link } from 'react-router-dom'
import { formatReferenceRange, parseVerseId } from '../reading/books'
import { groupByLabel } from '../topics/naveGrouping'
import type { PrayerGroundingGroup } from './usePrayerGrounding'

interface PrayerGroundingProps {
  groups: PrayerGroundingGroup[]
}

export function PrayerGrounding({ groups }: PrayerGroundingProps) {
  if (groups.length === 0) {
    return <p className="placeholder">No matching topics found in Nave's Topical Bible for this one yet.</p>
  }

  return (
    <div className="prayer-grounding">
      {groups.map(({ topic, entries }) => {
        const labelGroups = groupByLabel(entries)
        return (
          <div key={topic} className="prayer-grounding-topic">
            <h4 className="prayer-grounding-topic-title">{topic}</h4>
            {labelGroups.map((g, i) => (
              <p key={i} className="prayer-grounding-refs">
                {g.label && <span className="prayer-grounding-label">{g.label}: </span>}
                {g.refs.map((ref, j) => {
                  const target = parseVerseId(ref.verse_start)
                  return (
                    <span key={ref.id}>
                      <Link
                        to={`/?book=${target.book}&chapter=${target.chapter}&verse=${target.verse}`}
                        className="verse-panel-ref-link"
                      >
                        {formatReferenceRange(ref.verse_start, ref.verse_end)}
                      </Link>
                      {j < g.refs.length - 1 && '; '}
                    </span>
                  )
                })}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
