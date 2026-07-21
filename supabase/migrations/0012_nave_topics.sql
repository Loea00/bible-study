-- Nave's Topical Bible (spec §4.3 "topic → verse lists"). Reference data,
-- same open-RLS pattern as strongs_lexicon/tsk_cross_references/
-- commentary_entries. Also intended as Layer 1 of the prayer tracker's
-- AI-grounding design (spec-amendment-v1-2 §B5) -- free, offline
-- topic-to-verse matching before ever reaching a paid AI call.
--
-- One row per (topic, verse-range) pair -- Nave's groups references under
-- descriptive sub-labels within a topic (e.g. AARON -> "Marriage of",
-- "Death and burial of"), preserved as `label` since it's genuine
-- structure from the source, not just noise. verse_start/verse_end cover
-- a range (start = end for a single verse), same convention used
-- everywhere else in this schema. Sourced via scripts/transform_nave.py
-- from the CrossWire SWORD Nave module (public domain) into
-- data/nave_topics.csv; import via Table Editor → this table.

create table nave_topics (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  label text,
  verse_start text not null,
  verse_end text not null
);

create index nave_topics_topic_idx on nave_topics (topic);
create index nave_topics_verse_start_idx on nave_topics (verse_start);

alter table nave_topics enable row level security;

create policy "nave_topics_read_all" on nave_topics for select using (true);

-- Distinct topic-name search, same shape as verses_for_strongs (migration
-- 0007) — plain PostgREST select() has no DISTINCT, and each topic has
-- many verse rows, so a naive select would return heavily duplicated
-- topic strings for popular topics.
create or replace function search_nave_topics(query text, max_results int default 50)
returns table (topic text)
language sql
stable
as $$
  select distinct nt.topic
  from nave_topics nt
  where nt.topic ilike '%' || query || '%'
  order by nt.topic
  limit max_results;
$$;
