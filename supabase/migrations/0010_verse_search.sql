-- Full-text search over scripture text (spec §5.2 "search"). A generated
-- column keeps the tsvector automatically in sync with `text` — no trigger,
-- no app-side write path to maintain. GIN index makes plainto_tsquery
-- lookups fast even across all translations/books.

alter table verses
  add column search_vector tsvector generated always as (to_tsvector('english', text)) stored;

create index verses_search_vector_idx on verses using gin (search_vector);
