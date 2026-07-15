-- Phase 1 schema: entries, verse_references, reading_sessions.
-- Auth/users table is Supabase-managed (auth.users); no separate profile
-- table yet since Phase 1 is single-user (Aaron only).
--
-- entry_type carries the full Phase 2/3 vocabulary (reflection,
-- templated_journal) even though Phase 1 UI only writes margin_note and
-- journal, per the spec's "schema supports all phases from day one" rule.

create extension if not exists "pgcrypto";

create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_type text not null check (entry_type in ('margin_note', 'journal', 'reflection', 'templated_journal')),
  title text,
  body text not null default '',
  template_id uuid,
  template_responses jsonb,
  anchor_start text,
  anchor_end text,
  tags text[] not null default '{}',
  session_id uuid
);

create index entries_user_id_idx on entries (user_id);
create index entries_anchor_idx on entries (anchor_start, anchor_end);
create index entries_session_id_idx on entries (session_id);

create table verse_references (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  verse_start text not null,
  verse_end text not null,
  position integer,
  ref_kind text not null check (ref_kind in ('anchor', 'inline'))
);

create index verse_references_entry_id_idx on verse_references (entry_id);
create index verse_references_user_id_idx on verse_references (user_id);
create index verse_references_verse_range_idx on verse_references (verse_start, verse_end);

create table reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  passage_start text,
  passage_end text,
  last_position text
);

create index reading_sessions_user_id_idx on reading_sessions (user_id);

alter table entries add constraint entries_session_id_fkey
  foreign key (session_id) references reading_sessions (id) on delete set null;

-- Row-level security: every table is scoped to auth.uid(), which is the
-- "hard privacy wall" the spec requires between user content and admin
-- eyes (section 9.2) — enforced here from day one, not bolted on later.

alter table entries enable row level security;
alter table verse_references enable row level security;
alter table reading_sessions enable row level security;

create policy "entries_owner_all" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "verse_references_owner_all" on verse_references
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reading_sessions_owner_all" on reading_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
