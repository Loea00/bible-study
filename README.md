# Bible Study App

Phase 1 scaffold: React + TypeScript (Vite) frontend, Supabase (Postgres/auth) backend. See
`bible-study-app-spec.md` for the full product spec.

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

Auth is email magic-link (Supabase OTP). Phase 1 is single-user (Aaron), but every table is
scoped by `user_id` with row-level security from day one, so opening the app to more users later
is a matter of enabling sign-ups, not restructuring data.

## Project layout

- `src/lib/supabase.ts` — Supabase client
- `src/types/db.ts` — hand-written types mirroring the schema (regenerate with
  `supabase gen types typescript` once the project is linked)
- `src/features/auth/` — sign-in + session context
- `src/features/reading/` — reading view (scripture-first home)
- `src/features/journal/` — journal timeline + editor
- `supabase/migrations/` — schema: `entries`, `verse_references`, `reading_sessions` (user
  content) and `translations`, `verses` (bundled public-domain reference text — KJV/WEB/ASV;
  seeding the actual verse text is a separate data-ingestion task)

## Status

Scaffold only: routing, auth gating, DB schema, and typed Supabase client are wired up. The
reading view and journal pages are placeholders — no scripture rendering, verse tagging, or side
panel yet.
