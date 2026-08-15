-- Fixes get_or_create_invite_code() failing with "function gen_random_bytes
-- (integer) does not exist". The function sets search_path = public (a
-- deliberate security definer best practice — never trust an unqualified
-- search path), but Supabase installs pgcrypto's functions into the
-- extensions schema, not public, so gen_random_bytes was never reachable.
-- The other three security definer functions added in 0019/0020 never hit
-- this because none of them call a pgcrypto function.

create or replace function get_or_create_invite_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
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
