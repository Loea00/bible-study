-- Optional example content, not a schema migration -- run this once in the
-- Supabase SQL Editor if you'd like sample entries showing what each
-- writing feature is for. Every title is prefixed "Example:" so these are
-- easy to find and delete later (just delete the prayer_requests row --
-- its entries cascade -- and the two standalone entries by title).
--
-- Creates:
--   1. A prayer request with a four-entry "journey" (Concern, Word,
--      Update, Vision -- spread across the last week so it reads like a
--      real one, not four entries all timestamped the same second).
--   2. A plain Journal entry.
--   3. A Reflection anchored to Psalm 46:1-3, with its verse_references
--      anchor rows so it renders correctly everywhere reflections show up.

do $$
declare
  v_user_id uuid;
  v_request_id uuid;
  v_reflection_id uuid;
begin
  select id into v_user_id from auth.users limit 1;

  insert into prayer_requests (user_id, title, description, status)
  values (
    v_user_id,
    'Example: Guidance for a big decision',
    'A sample prayer request showing how the Journey feature works -- tap "Show journey" below to see Update, Word, Concern, and Vision entries. Delete this whenever you like.',
    'active'
  )
  returning id into v_request_id;

  insert into entries (user_id, entry_type, title, body, request_id, created_at, updated_at)
  values
    (v_user_id, 'concern', 'Example: Concern', 'Feeling anxious about which way to go, and worried about disappointing someone I love if I choose wrong. Naming that honestly here rather than pushing it down.', v_request_id, now() - interval '6 days', now() - interval '6 days'),
    (v_user_id, 'word', 'Example: Word', 'Reading Isaiah 30:21 this morning -- "This is the way, walk in it." A quiet reassurance that clarity will come at the right time, even if it hasn''t yet.', v_request_id, now() - interval '4 days', now() - interval '4 days'),
    (v_user_id, 'prayer_update', 'Example: Update', 'Talked it through with a mentor today. Still no final answer, but I feel more at peace carrying the question instead of rushing it.', v_request_id, now() - interval '2 days', now() - interval '2 days'),
    (v_user_id, 'vision', 'Example: Vision', 'What I''m hoping for isn''t just picking the "right" option -- it''s growing in trust, whichever door ends up open.', v_request_id, now(), now());

  insert into entries (user_id, entry_type, title, body, tags, created_at, updated_at)
  values (
    v_user_id,
    'journal',
    'Example: A journal entry',
    'This is a sample Journal entry -- a free space for whatever''s on your mind, not tied to any one passage. Mention a verse inline like @Psa 46:10 anywhere and it links automatically. Delete this whenever you like.',
    array['example'],
    now() - interval '1 day',
    now() - interval '1 day'
  );

  insert into entries (user_id, entry_type, title, body, anchor_start, anchor_end, created_at, updated_at)
  values (
    v_user_id,
    'reflection',
    'Example: A reflection on Psalm 46',
    'This is a sample Reflection -- it anchors automatically to the passage you were reading (Psalm 46:1-3 here) instead of needing to be manually tagged. It shows up on the passage itself, in Journal under Reflections, and can be tied to a highlight too. Delete this whenever you like.',
    'PSA.46.1',
    'PSA.46.3',
    now(),
    now()
  )
  returning id into v_reflection_id;

  insert into verse_references (entry_id, user_id, verse_start, verse_end, ref_kind)
  values
    (v_reflection_id, v_user_id, 'PSA.46.1', 'PSA.46.1', 'anchor'),
    (v_reflection_id, v_user_id, 'PSA.46.2', 'PSA.46.2', 'anchor'),
    (v_reflection_id, v_user_id, 'PSA.46.3', 'PSA.46.3', 'anchor');
end $$;
