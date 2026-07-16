-- Spec amendment v1.1: unified span anchoring + highlight regrouping.
--
-- A2: verse_references gains sub-verse anchoring columns, shared by every
-- reference type (notes, highlights, journal tags), not just highlights.
-- Nullable and additive — existing rows mean "whole verse" (unchanged).

alter table verse_references
  add column start_offset integer,
  add column end_offset integer,
  add column translation text;

-- A3: highlights move from one-row-per-verse to one-row-per-group, with a
-- `spans` array covering every shape (partial verse, whole verse, multiple
-- verses, non-consecutive parts) in a single row. Phase 1 only ever writes
-- single-span, whole-verse groups (offsets null) until text-selection ships;
-- the shape supports the rest without another migration.

alter table highlights rename to highlights_v1;

-- Index names are unique per-schema in Postgres, not per-table, so the old
-- indexes (still attached to the renamed table) would collide with the new
-- table's indexes below. Drop them now — highlights_v1 is dropped entirely
-- a few statements down anyway, so they're not needed for that long.
drop index highlights_user_id_idx;
drop index highlights_verse_range_idx;

create table highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  color text not null check (color in ('yellow', 'green', 'blue', 'pink', 'purple')),
  translation text,
  spans jsonb not null
);

create index highlights_user_id_idx on highlights (user_id);
create index highlights_spans_gin_idx on highlights using gin (spans);

alter table highlights enable row level security;

create policy "highlights_owner_all" on highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A7: migrate existing whole-verse highlights into the new shape, preserving
-- id/color/timestamps so nothing already created is lost.
insert into highlights (id, user_id, created_at, color, translation, spans)
select
  id,
  user_id,
  created_at,
  color,
  null,
  jsonb_build_array(
    jsonb_build_object('verse_id', verse_start, 'start_offset', null, 'end_offset', null)
  )
from highlights_v1;

drop table highlights_v1;
