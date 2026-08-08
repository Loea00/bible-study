-- Privacy PIN: a UI-level "glance protection" gate for marking Journal
-- entries, Reflections, prayer-journey entries, and prayer requests as
-- Private, replacing their content with a placeholder until the correct
-- PIN is entered. This is NOT encryption -- content is still stored and
-- fetched normally (already protected the same way as everything else,
-- by Supabase Auth + row-level security); it only withholds content from
-- casual view (a glance at the screen, a borrowed device). The PIN is
-- hashed with pgcrypto's bcrypt (crypt()/gen_salt('bf')) and compared
-- server-side via RPC, so the raw PIN never needs to round-trip in
-- plaintext after being set -- but this stays recoverable by design: if
-- forgotten, clearing this table's row and setting a new PIN restores
-- access (nothing becomes permanently unreadable), unlike real
-- encryption, where a forgotten password would mean the content is gone
-- forever.
--
-- Deliberately separate from prayer_requests.visibility
-- (private/shared/group/public) -- that column is reserved for future
-- social-sharing scope (spec-amendment-v1-2 §B8) and has nothing to do
-- with this PIN gate.

create table user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  privacy_pin_hash text,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;
create policy "user_settings_owner_all" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function set_privacy_pin(pin text)
returns void
language plpgsql
as $$
begin
  insert into user_settings (user_id, privacy_pin_hash, updated_at)
  values (auth.uid(), crypt(pin, gen_salt('bf')), now())
  on conflict (user_id) do update set privacy_pin_hash = excluded.privacy_pin_hash, updated_at = now();
end;
$$;

create or replace function verify_privacy_pin(pin text)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select privacy_pin_hash = crypt(pin, privacy_pin_hash) from user_settings where user_id = auth.uid()),
    false
  );
$$;

alter table entries add column is_private boolean not null default false;
alter table prayer_requests add column is_private boolean not null default false;
