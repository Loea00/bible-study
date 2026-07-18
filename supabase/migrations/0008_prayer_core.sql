-- Prayer tracker core (spec-amendment-v1-2-prayer-social.md §B2, §B8).
--
-- Three new tables: prayer_lists (user-defined groupings), prayer_requests
-- (the request itself, with status/visibility/cached AI grounding),
-- prayed_marks (the one-tap "I prayed for this" gesture — deliberately
-- writing-free, same doctrine as highlights).
--
-- visibility on prayer_requests and user_id on prayed_marks ship now even
-- though sharing is Phase 4 (§B8: "so no later migration is disruptive").
--
-- entries also gains a nullable request_id (prayer-attached writing —
-- progress notes, sensed words, concerns — stays in the existing unified
-- entries store rather than a separate table) and three new entry_type
-- values: prayer_update, word, concern.

create table prayer_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index prayer_lists_user_id_idx on prayer_lists (user_id);

create table prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  list_id uuid references prayer_lists (id) on delete set null,
  created_at timestamptz not null default now(),
  title text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'ongoing', 'answered', 'archived')),
  answered_at timestamptz,
  answered_note text,
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'group', 'public')),
  grounding jsonb,
  grounding_generated_at timestamptz
);

create index prayer_requests_user_id_idx on prayer_requests (user_id);
create index prayer_requests_list_id_idx on prayer_requests (list_id);
create index prayer_requests_status_idx on prayer_requests (status);

create table prayed_marks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references prayer_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  session_id uuid references reading_sessions (id) on delete set null
);

create index prayed_marks_request_id_idx on prayed_marks (request_id);
create index prayed_marks_user_id_idx on prayed_marks (user_id);

alter table entries add column request_id uuid references prayer_requests (id) on delete set null;
create index entries_request_id_idx on entries (request_id);

alter table entries drop constraint entries_entry_type_check;
alter table entries add constraint entries_entry_type_check
  check (entry_type in ('margin_note', 'journal', 'reflection', 'templated_journal', 'prayer_update', 'word', 'concern'));

alter table prayer_lists enable row level security;
alter table prayer_requests enable row level security;
alter table prayed_marks enable row level security;

create policy "prayer_lists_owner_all" on prayer_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "prayer_requests_owner_all" on prayer_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "prayed_marks_owner_all" on prayed_marks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
