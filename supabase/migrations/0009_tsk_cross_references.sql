-- Treasury of Scripture Knowledge cross-references (Phase 2, spec §5.1 —
-- "TSK cross-references" side-panel section). Reference data, same pattern
-- as strongs_lexicon/word_tags: read-only, public, no per-user RLS needed.
--
-- One row per (from-verse, to-range) pair. to_verse_start/to_verse_end are
-- both set even for a single-verse target (start = end) — same convention
-- verse_references already uses for a single-verse span, rather than a
-- nullable end column. Sourced via scripts/transform_tsk.py from the
-- CrossWire SWORD TSK module (public domain) into
-- data/tsk_cross_references.csv; import via Table Editor → this table.

create table tsk_cross_references (
  id uuid primary key default gen_random_uuid(),
  from_verse_id text not null,
  to_verse_start text not null,
  to_verse_end text not null
);

create index tsk_cross_references_from_verse_id_idx on tsk_cross_references (from_verse_id);

alter table tsk_cross_references enable row level security;

create policy "tsk_cross_references_read_all" on tsk_cross_references for select using (true);
