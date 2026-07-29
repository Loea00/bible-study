-- Reflections composed via a highlight's "Reflect" action before this
-- feature existed anchor to the same span range as their highlight, but
-- were never tagged with highlight_id (that column/parameter didn't exist
-- yet). Backfill by matching anchor_start/anchor_end to a highlight's
-- first/last span -- skipped when more than one highlight matches the same
-- range, since that's ambiguous and better left for manual reconciliation.

update entries e
set highlight_id = h.id
from highlights h
where e.entry_type = 'reflection'
  and e.highlight_id is null
  and e.anchor_start = h.spans->0->>'verse_id'
  and e.anchor_end = h.spans->(jsonb_array_length(h.spans) - 1)->>'verse_id'
  and (
    select count(*) from highlights h2
    where h2.spans->0->>'verse_id' = e.anchor_start
      and h2.spans->(jsonb_array_length(h2.spans) - 1)->>'verse_id' = e.anchor_end
  ) = 1;
