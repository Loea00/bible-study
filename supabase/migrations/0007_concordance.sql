-- Concordance lookup ("other occurrences" from the lexicon card).
--
-- word_tags.strongs_ids is a comma-separated text column (migration 0006 —
-- Table Editor CSV import couldn't handle a real text[] array), so a plain
-- LIKE '%H430%' would false-positive on H4300, H2430, etc. Splitting on
-- comma and checking exact membership avoids that.

create or replace function verses_for_strongs(target_id text, max_results int default 300)
returns table (verse_id text, tag_text text)
language sql
stable
as $$
  select wt.verse_id, wt.text
  from word_tags wt
  where wt.translation_code = 'KJV'
    and target_id = any(string_to_array(wt.strongs_ids, ','))
  order by wt.verse_id
  limit max_results;
$$;
