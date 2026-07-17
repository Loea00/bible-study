-- Supabase's Table Editor CSV importer can't parse Postgres array-literal
-- syntax ("{G976}") for a text[] column — it silently treats it as null,
-- which then trips the not-null constraint. word_tags is still empty (every
-- import attempt failed before any rows landed), so just swap the column
-- type rather than migrate data. Comma-separated text is fine: nothing
-- queries this column at the SQL level yet, and the one place that will
-- (the eventual tap-word UI) reads it in application code either way.

alter table word_tags drop column strongs_ids;
alter table word_tags add column strongs_ids text not null;
