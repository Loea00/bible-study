-- Commentaries with SWORD-format book-level introductions (Pentateuch/book
-- overviews, authorship/date essays) that were previously glued onto verse
-- 1's own commentary entry -- confirmed systemic in JFB (65 book-opening
-- entries bloated with the whole intro essay, up to 80KB for Genesis) and,
-- more mildly, MHCC. Pulled out into their own table so they render once
-- above chapter 1, not buried behind "Show more" on a single verse.
--
-- Same generalized `source` design as commentary_entries -- one row per
-- (source, book), reused across JFB now and MHCC/Barnes in a later pass.

create table book_introductions (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  book text not null,
  body text not null
);

create unique index book_introductions_source_book_idx on book_introductions (source, book);

alter table book_introductions enable row level security;

create policy "book_introductions_read_all" on book_introductions for select using (true);
