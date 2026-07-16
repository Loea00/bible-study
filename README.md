# Bible Study App

Phase 1 scaffold: React + TypeScript (Vite) frontend, Supabase (Postgres/auth) backend. See
`bible-study-app-spec.md` for the full product spec, plus `spec-amendment-v1-1-highlights.md`
(span anchoring, unified across notes/highlights/journal tags) and
`spec-amendment-v1-2-prayer-social.md` (Phase 2+ prayer system, AI grounding, social — roadmap
only, no code yet).

## Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/` (in order) via the Supabase SQL editor or CLI.
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
4. `npm install`
5. `npm run dev`

Auth is email + password (switched from magic-link — Supabase's built-in email service rate-limits
hard and custom SMTP isn't set up yet). New accounts are created via Supabase dashboard →
Authentication → Users → Add User with "Auto Confirm User" checked, no email involved. Phase 1 is
single-user (Aaron), but every table is scoped by `user_id` with row-level security from day one,
so opening the app to more users later is a matter of enabling sign-ups, not restructuring data.

## Project layout

- `src/lib/supabase.ts` — Supabase client
- `src/types/db.ts` — hand-written types mirroring the schema (regenerate with
  `supabase gen types typescript` once the project is linked)
- `src/features/auth/` — sign-in + session context
- `src/features/reading/` — reading view (scripture-first home)
- `src/features/journal/` — journal timeline + editor
- `supabase/migrations/` — schema: `entries`, `verse_references`, `reading_sessions` (user
  content), `translations`/`verses` (bundled public-domain reference text), `highlights`
  (group-based spans per amendment v1.1)

## Seeding scripture text

KJV and ASV are sourced from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
(public domain, verse-per-row CSV). WEB isn't in that particular repo under that name — still
need to find a source for it.

```
mkdir -p data
curl -sL -o data/KJV.csv https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/csv/KJV.csv
curl -sL -o data/ASV.csv https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/csv/ASV.csv
python3 scripts/transform_kjv.py
```

That produces `data/verses_seed.csv` (verse_id, translation_code, book, chapter, verse, text —
matching the `verses` table columns exactly). Import it via Supabase dashboard → Table Editor →
`verses` → Insert → Import data from CSV.

## Status

Phase 1 in progress. Done: scaffold deployed (Vercel + Supabase, live), DB schema (incl. v1.1 span
anchoring), auth (email+password), reading view renders real KJV/ASV text by book/chapter with a
translation switcher, margin notes (add/delete), verse highlighting in 5 colors (add/remove),
journal (timeline + editor, inline `@Book chapter:verse` tagging that resolves to a clickable chip
with an inline preview and "Open in reading view" deep link — see
`src/features/journal/verseTagParser.ts`; tags are parsed on save/render rather than live
autocomplete-while-typing, a deliberate Phase 1 simplification vs. the spec's described UX).
Still open: the fuller side panel (journal/reflection excerpts alongside margin notes — currently
each surface is separate), reading-session auto-capture. Text selection (drag-to-select,
multi-span highlights/notes, word-tap lexicon) is designed per amendment v1.1 §A9 but not built —
current interaction is still tap-the-whole-verse.
