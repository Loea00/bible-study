-- Public-domain Bible commentaries (spec §102, Phase 2+ "optional panel
-- section"). Reference data, same read-only pattern as strongs_lexicon/
-- tsk_cross_references. Generalized across sources (`source` column) so
-- the next commentary (JFB, planned) reuses this table rather than
-- needing its own migration -- Aaron's stated intent is "ideally all
-- three eventually," not just one, so this is a near-certain reuse, not
-- speculative design.
--
-- One row per commentary "chunk" -- Matthew Henry (and most commentaries)
-- often comment on several consecutive verses in one breath, so
-- verse_start/verse_end cover a range (start = end for a single verse,
-- same convention tsk_cross_references/verse_references already use).
-- Sourced via scripts/transform_mhcc.py from the CrossWire SWORD MHCC
-- module (public domain) into data/mhcc_commentary.csv; import via
-- Table Editor → this table.

create table commentary_entries (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  verse_start text not null,
  verse_end text not null,
  body text not null
);

create index commentary_entries_verse_start_idx on commentary_entries (verse_start);
create index commentary_entries_source_idx on commentary_entries (source);

alter table commentary_entries enable row level security;

create policy "commentary_entries_read_all" on commentary_entries for select using (true);
