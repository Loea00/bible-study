-- Verse highlights: a color marking, not written content, so it's kept
-- separate from `entries` (which is reserved for anything with a body).
-- Phase 1 only anchors single verses (verse_start = verse_end); range
-- support falls out naturally once text-selection ships in Phase 2.

create table highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  verse_start text not null,
  verse_end text not null,
  color text not null check (color in ('yellow', 'green', 'blue', 'pink', 'purple')),
  created_at timestamptz not null default now(),
  unique (user_id, verse_start, verse_end)
);

create index highlights_user_id_idx on highlights (user_id);
create index highlights_verse_range_idx on highlights (verse_start, verse_end);

alter table highlights enable row level security;

create policy "highlights_owner_all" on highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
