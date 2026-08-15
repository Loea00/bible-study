-- Phase 4: Community, step 1 (spec-amendment-v1-2-prayer-social.md §B7) —
-- friendships, moderation primitives, and prayer sharing. Groups/boards/
-- group reading plans are a later step, not included here.
--
-- Build order matters within this file: profiles first (nothing else can
-- reference a user's display name without it), then friendships, then
-- blocks/reports (moderation exists *before* sharing goes live, per the
-- spec's "required the day anything is shareable" framing), then
-- prayer_shares, then finally the cross-user read policies that depend on
-- all of the above existing.

-- entries gains 'encouragement' — a friend's words of support on a request
-- shared with them (§B7.1), the one entry_type authored by someone other
-- than the row it's conceptually "about."
alter table entries drop constraint entries_entry_type_check;
alter table entries add constraint entries_entry_type_check
  check (entry_type in ('margin_note', 'journal', 'reflection', 'templated_journal', 'prayer_update', 'word', 'concern', 'vision', 'encouragement'));

-- ── profiles ────────────────────────────────────────────────────────────
-- auth.users isn't queryable from the client at all (not exposed via
-- PostgREST), so a public-safe profile row is the only way a friend (or a
-- friend search) can ever see someone's name. email is stored here too —
-- kept out of any broad-read policy below; search_profiles() is the only
-- path that can match against it, and it never echoes the address back.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  full_name text,
  invite_code text unique,
  created_at timestamptz not null default now()
);

create index profiles_display_name_idx on profiles (display_name);
create index profiles_full_name_idx on profiles (full_name);

alter table profiles enable row level security;

create policy "profiles_self_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_self_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row the moment someone signs up. security definer
-- is required here (not just convenient) — this trigger fires as part of
-- the auth service's own insert into auth.users, outside any RLS-checkable
-- request context, so it needs to bypass profiles' RLS to do its one job.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: the trigger above only covers signups from this point forward.
-- Every account that already exists needs a profile row too, or search/
-- friends is broken for them until their next signup (which never happens
-- again).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ── friendships ─────────────────────────────────────────────────────────
-- Mutual consent: requester inserts a 'pending' row, addressee flips it to
-- 'accepted' (or the requester deletes it to cancel). Either party can
-- delete an accepted row to unfriend. A declined request is just deleted,
-- not a third status — nothing meaningful to preserve once declined.

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create index friendships_requester_idx on friendships (requester_id);
create index friendships_addressee_idx on friendships (addressee_id);
-- One row per unordered pair, regardless of who requested — prevents a
-- duplicate/reciprocal request from ever being created.
create unique index friendships_unique_pair_idx on friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

alter table friendships enable row level security;

create policy "friendships_participant_select" on friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_requester_insert" on friendships
  for insert with check (auth.uid() = requester_id);

-- Only the addressee can act on a pending request, and only to accept it —
-- there's no "reject" state to write to (see comment above); declining is
-- a delete, covered by the participant_delete policy below.
create policy "friendships_addressee_accept" on friendships
  for update using (auth.uid() = addressee_id and status = 'pending')
  with check (status = 'accepted');

create policy "friendships_participant_delete" on friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── blocks ──────────────────────────────────────────────────────────────
-- Blocker-only visibility, both directions — the blocked party has no way
-- to see they've been blocked (standard practice, not just this app's
-- convention). Blocking doesn't auto-delete an existing friendship at the
-- database level; the app does that as an explicit paired action.

create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocker_idx on blocks (blocker_id);

alter table blocks enable row level security;

create policy "blocks_owner_all" on blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- ── reports ─────────────────────────────────────────────────────────────
-- Records a report for manual review (via direct Supabase dashboard
-- access, not an in-app admin panel — deliberately out of scope for this
-- pass). No update/delete policy for the reporter: a filed report is a
-- record, not something to quietly retract.

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('prayer_request', 'entry', 'user')),
  target_id uuid not null,
  reason text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now()
);

create index reports_reporter_idx on reports (reporter_id);

alter table reports enable row level security;

create policy "reports_reporter_insert" on reports
  for insert with check (auth.uid() = reporter_id);

create policy "reports_reporter_select" on reports
  for select using (auth.uid() = reporter_id);

-- ── prayer_shares ───────────────────────────────────────────────────────
-- "shared" visibility means named friends, not "all my friends" — this
-- join table is who, specifically, a request has been shared with.

create table prayer_shares (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references prayer_requests (id) on delete cascade,
  shared_with_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, shared_with_id)
);

create index prayer_shares_request_idx on prayer_shares (request_id);
create index prayer_shares_shared_with_idx on prayer_shares (shared_with_id);

alter table prayer_shares enable row level security;

create policy "prayer_shares_owner_manage" on prayer_shares
  for all using (
    exists (select 1 from prayer_requests pr where pr.id = prayer_shares.request_id and pr.user_id = auth.uid())
  )
  with check (
    exists (select 1 from prayer_requests pr where pr.id = prayer_shares.request_id and pr.user_id = auth.uid())
  );

create policy "prayer_shares_recipient_select" on prayer_shares
  for select using (auth.uid() = shared_with_id);

-- ── cross-user read policies ────────────────────────────────────────────
-- These are additive (permissive) policies alongside each table's existing
-- owner-only "for all" policy — Postgres OR's multiple permissive policies
-- together, so the owner-only policy still fully governs insert/update/
-- delete; these only ever *add* read access, never remove it.

-- A friend can see a request shared specifically with them.
create policy "prayer_requests_shared_read" on prayer_requests
  for select using (
    visibility = 'shared'
    and exists (
      select 1 from prayer_shares ps
      where ps.request_id = prayer_requests.id and ps.shared_with_id = auth.uid()
    )
  );

-- The request owner can see every prayed_mark on their own request, not
-- just the ones they made themselves — this is what makes "so-and-so
-- prayed for this" (§B7.1) possible at all; without it, a friend's mark on
-- a shared request would be invisible to the very person it's meant to
-- encourage. Deliberately owner-only for now, not visible to other
-- shared-with friends too — a simple scope call, not a spec requirement.
create policy "prayed_marks_request_owner_read" on prayed_marks
  for select using (
    exists (
      select 1 from prayer_requests pr
      where pr.id = prayed_marks.request_id and pr.user_id = auth.uid()
    )
  );

-- Encouragement entries are visible to the request's owner and to anyone
-- the request is shared with (a shared comment thread, not owner-only) —
-- entries.user_id = the encouragement's author already lets the author
-- read their own via the existing owner policy; this adds everyone else
-- who can legitimately see the request itself.
create policy "entries_read_shared_encouragement" on entries
  for select using (
    entry_type = 'encouragement'
    and request_id is not null
    and exists (
      select 1 from prayer_requests pr
      where pr.id = entries.request_id
        and (
          pr.user_id = auth.uid()
          or exists (select 1 from prayer_shares ps where ps.request_id = pr.id and ps.shared_with_id = auth.uid())
        )
    )
  );

-- A profile is visible beyond its owner only to someone with an actual
-- relationship to it: a friendship (pending or accepted, so a request you
-- haven't responded to yet still shows a name) or a prayer share in either
-- direction. This is the one place in the app where read access depends on
-- a relationship rather than plain ownership — search_profiles() below is
-- the only way to discover someone with no relationship yet.
create policy "profiles_related_read" on profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
    or exists (
      select 1 from prayer_shares ps
      join prayer_requests pr on pr.id = ps.request_id
      where (ps.shared_with_id = auth.uid() and pr.user_id = profiles.id)
         or (pr.user_id = auth.uid() and ps.shared_with_id = profiles.id)
    )
    -- Blocking someone deletes the friendship row that would otherwise be
    -- the read path to their name — without this, a blocked user's profile
    -- becomes permanently unreadable to the very person who needs to see
    -- who's on their own blocked list.
    or exists (
      select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = profiles.id
    )
  );

-- ── search_profiles ─────────────────────────────────────────────────────
-- Friend search by email (exact match only), display name, or real name
-- (substring). security definer so it can look across every profile row
-- regardless of the read policy above — the narrowness has to live in the
-- function body instead: never returns the email column itself (only
-- whether the query matched it, since the searcher already typed it and
-- doesn't need it echoed back), excludes the caller, and excludes anyone
-- blocked in either direction.
create or replace function search_profiles(query text, max_results int default 20)
returns table (id uuid, display_name text, full_name text, email_match boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.full_name,
    (lower(p.email) = lower(query)) as email_match
  from profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and trim(query) <> ''
    and not exists (select 1 from blocks b where b.blocker_id = p.id and b.blocked_id = auth.uid())
    and not exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id)
    and (
      lower(p.email) = lower(query)
      or p.display_name ilike '%' || query || '%'
      or p.full_name ilike '%' || query || '%'
    )
  order by email_match desc, p.display_name nulls last
  limit max_results;
$$;

-- ── shareable invite link ───────────────────────────────────────────────
-- get_or_create_invite_code(): lazily assigns the caller a stable code
-- (their personal /invite/<code> link) the first time it's requested.
create or replace function get_or_create_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select invite_code into code from profiles where id = auth.uid();
  if code is null then
    code := encode(gen_random_bytes(6), 'hex');
    update profiles set invite_code = code where id = auth.uid();
  end if;
  return code;
end;
$$;

-- accept_invite(): visiting someone's invite link and confirming creates
-- (or accepts an already-pending) friendship directly, no separate
-- approval step from the link owner — sharing the link *is* their consent,
-- clicking it *is* the visitor's. security definer since the resulting
-- friendship's requester_id is the link owner, not the caller, which the
-- normal friendships_requester_insert policy wouldn't allow.
create or replace function accept_invite(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  existing_id uuid;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into owner_id from profiles where invite_code = code;
  if owner_id is null then
    raise exception 'Invalid invite link';
  end if;
  if owner_id = auth.uid() then
    raise exception 'This is your own invite link';
  end if;

  if exists (
    select 1 from blocks
    where (blocker_id = owner_id and blocked_id = auth.uid())
       or (blocker_id = auth.uid() and blocked_id = owner_id)
  ) then
    raise exception 'Could not add this friend';
  end if;

  select id into existing_id from friendships
    where (requester_id = owner_id and addressee_id = auth.uid())
       or (requester_id = auth.uid() and addressee_id = owner_id);

  if existing_id is not null then
    update friendships set status = 'accepted', responded_at = now()
      where id = existing_id and status <> 'accepted';
    return existing_id;
  end if;

  insert into friendships (requester_id, addressee_id, status, responded_at)
  values (owner_id, auth.uid(), 'accepted', now())
  returning id into new_id;
  return new_id;
end;
$$;
