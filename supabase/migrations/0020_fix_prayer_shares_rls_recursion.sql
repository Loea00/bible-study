-- Fixes infinite RLS recursion introduced by migration 0019.
--
-- prayer_shares_owner_manage (on prayer_shares) checked ownership via a
-- plain subquery on prayer_requests. That subquery triggers prayer_requests'
-- own RLS policies — including prayer_requests_shared_read, which queries
-- prayer_shares. Querying prayer_shares triggers ITS policies again,
-- including prayer_shares_owner_manage, which queries prayer_requests
-- again — an unbounded cycle. Postgres hits its stack-depth limit and
-- errors out, which PostgREST surfaces to the client as a 500 — for
-- *every* query touching entries, prayer_requests, or profiles (all of
-- which reach this cycle transitively), for every account, not just one.
--
-- Fixed by moving the ownership check into a security definer function.
-- Because the function is owned by the migration role (which bypasses RLS
-- entirely), its internal read of prayer_requests never re-triggers
-- prayer_requests' policies, breaking the cycle at that one link.

create or replace function is_prayer_request_owner(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from prayer_requests pr where pr.id = p_request_id and pr.user_id = auth.uid()
  );
$$;

drop policy "prayer_shares_owner_manage" on prayer_shares;

create policy "prayer_shares_owner_manage" on prayer_shares
  for all using (is_prayer_request_owner(prayer_shares.request_id))
  with check (is_prayer_request_owner(prayer_shares.request_id));
