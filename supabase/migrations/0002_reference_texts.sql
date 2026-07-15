-- Reference data: bundled public-domain translations (spec 4.3, 7).
-- Read-only, shared across all users — no RLS needed, but write access
-- is restricted to the service role via table privileges, not policies.
-- Verse text itself is seeded separately (data ingestion, not schema).

create table translations (
  code text primary key, -- 'KJV' | 'WEB' | 'ASV'
  name text not null,
  is_default boolean not null default false
);

create table verses (
  verse_id text not null, -- 'PSA.46.10' (OSIS-style)
  translation_code text not null references translations (code),
  book text not null,
  chapter integer not null,
  verse integer not null,
  text text not null,
  primary key (verse_id, translation_code)
);

create index verses_book_chapter_idx on verses (book, chapter);

alter table translations enable row level security;
alter table verses enable row level security;

create policy "translations_read_all" on translations for select using (true);
create policy "verses_read_all" on verses for select using (true);

insert into translations (code, name, is_default) values
  ('KJV', 'King James Version', true),
  ('WEB', 'World English Bible', false),
  ('ASV', 'American Standard Version', false);
