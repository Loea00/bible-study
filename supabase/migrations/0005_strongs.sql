-- Strong's word-tap lexicon (Phase 2, data-sourcing step only — no UI yet).
-- Reference data, same pattern as translations/verses: read-only, public,
-- no per-user RLS needed.

create table strongs_lexicon (
  strongs_id text primary key, -- 'H7225' | 'G3056'
  language text not null check (language in ('hebrew', 'greek')),
  lemma text not null, -- original-language word
  transliteration text,
  pronunciation text,
  derivation text,
  definition text,
  kjv_def text -- how it's rendered across the KJV
);

-- One row per tagged phrase within a verse (source data groups some
-- multi-word English phrases under one Strong's-tagged unit, e.g. "the
-- heaven" -> H8064, or one English word under several Strong's numbers,
-- e.g. "created" -> H0853 H1254). `position` is sequence order within the
-- verse, not a character offset — aligning this to exact spans in
-- `verses.text` is deferred to when the tap-word UI actually gets built.
create table word_tags (
  id uuid primary key default gen_random_uuid(),
  verse_id text not null,
  translation_code text not null default 'KJV',
  position integer not null,
  text text not null,
  strongs_ids text[] not null,
  morph text
);

create index word_tags_verse_id_idx on word_tags (verse_id, translation_code);

alter table strongs_lexicon enable row level security;
alter table word_tags enable row level security;

create policy "strongs_lexicon_read_all" on strongs_lexicon for select using (true);
create policy "word_tags_read_all" on word_tags for select using (true);
