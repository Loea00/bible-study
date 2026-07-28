-- Unify highlight-scoped writing with margin notes. Previously a note
-- written from a highlight's "Note" action (reading pane) was a plain
-- margin_note anchored to the highlight's spans but with no highlight_id,
-- while a "highlight artifact" (Highlights page) was highlight_id-tagged
-- but had no anchor at all -- two disconnected concepts that each only
-- showed up on one surface. Now both are the same thing: a margin_note
-- anchored to the highlight's spans, with highlight_id set. This is what
-- makes a note show up in BOTH the reading pane's verse panel and the
-- Highlights page, regardless of which surface it was composed on.

-- Backfill anchor_start/anchor_end for existing highlight_artifact entries
-- from their highlight's first/last span.
update entries e
set anchor_start = h.spans->0->>'verse_id',
    anchor_end = h.spans->(jsonb_array_length(h.spans) - 1)->>'verse_id'
from highlights h
where e.entry_type = 'highlight_artifact' and e.highlight_id = h.id;

-- Backfill verse_references anchor rows (one per span), same shape
-- useMarginNotes.ts/useReflections.ts expect for multi-span anchoring.
insert into verse_references (entry_id, user_id, verse_start, verse_end, position, ref_kind, start_offset, end_offset, translation)
select e.id, e.user_id, s->>'verse_id', s->>'verse_id', null, 'anchor', (s->>'start_offset')::int, (s->>'end_offset')::int, h.translation
from entries e
join highlights h on h.id = e.highlight_id
cross join lateral jsonb_array_elements(h.spans) as s
where e.entry_type = 'highlight_artifact';

-- Retype existing highlight_artifact rows to margin_note now that they're
-- properly anchored, then drop the now-unused entry_type value.
update entries set entry_type = 'margin_note' where entry_type = 'highlight_artifact';

alter table entries drop constraint entries_entry_type_check;
alter table entries add constraint entries_entry_type_check
  check (entry_type in ('margin_note', 'journal', 'reflection', 'templated_journal', 'prayer_update', 'word', 'concern', 'vision'));
