# Bible Study App

Phase 1 scaffold: React + TypeScript (Vite) frontend, Supabase (Postgres/auth) backend. See
`bible-study-app-spec.md` for the full product spec, plus `spec-amendment-v1-1-highlights.md`
(span anchoring, unified across notes/highlights/journal tags), `spec-amendment-v1-2-prayer-social.md`
(Phase 2+ prayer system, AI grounding, social — roadmap only, no code yet), and
`spec-amendment-v1-4-theming.md` (token-based theme system, 4 themes + light/dark — **designed,
deliberately not started**; see TODO below).

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
The verse side panel is now the spec's "payoff feature" for real: tapping a verse shows margin
notes and journal excerpts (title, date, surrounding text, "Open full entry" deep-link that
scrolls to and highlights the entry on the journal page) grouped together, plus a quiet dot
indicator per type in the running text. Reflections and TSK cross-references aren't in the panel
yet since neither surface exists (Phase 2/3 per spec).

Reading sessions auto-capture in the background (`src/features/reading/useReadingSession.ts`):
opening the reading view starts or continues a session (rolling forward on each passage change,
30-minute inactivity gap before a new one starts) and writes `passage_start`/`passage_end`/
`last_position` to `reading_sessions`. Margin notes and journal entries created during an active
session now link to it via `entries.session_id` (previously always written as `null` — fixed
alongside the log surface below, since it's what the log's "expand a session" needs).

**All of Phase 1's original spec checklist is built.** Phase 2 is starting — first slice: the
**reading log** (`/log`, `src/features/log/`), the first Phase 2 item since it's pure payoff on
data already being captured, no new dataset or table needed. Stat cards (day streak, sessions this
month, notes this month) + a session list, each expandable to show what was written during it,
deep-linking back to the passage or journal entry. `computeStreak()` counts consecutive local
calendar days with at least one session; not having read yet *today* doesn't break it (spec
principle 3 — gentle, never enforced).

Still ahead in Phase 2: word-tap Strong's lexicon (also when the deferred text-selection gesture
model from amendment v1.1 §A9 gets built — drag-to-select, multi-span highlights/notes), calendar,
reading plans, TSK cross-references, search across own writing, "Today, I..." templates.

## TODO — amendment v1.4 (theming), intentionally deferred

Reviewed 2026-07-15, holding until after Strong's data sourcing (the currently agreed next
session). Not a small add — retrofit now, since Phase 1's UI already exists. Recommended split
when we do pick it up:
1. **Cheap, do first:** rename the existing CSS custom properties in `src/index.css` to match the
   amendment's token contract (`--surface-page`/`--surface-card`, `--text-ink`/`--text-muted`,
   `--text-christ`, `--accent`, `--border`/`--border-strong`, `--font-voice`/`--font-sans`/
   `--font-data`) — still just today's one look, no schema change, no visible difference.
2. **Real work:** new `themes` table + a `profiles` table (doesn't exist yet — we've only ever
   used `auth.users` directly, nothing stores per-user preferences today), design the actual color
   values for the four themes (Warm Paper, Vellum & Slate, Before Dawn, The Blue Period), build the
   Settings → Appearance picker.
3. **Separate dependency, bundle with Strong's work:** red-letter rendering needs words-of-Christ
   markup on the KJV text, which we don't have — it's its own small data-sourcing problem, not
   something the theming system itself solves.
