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
  (group-based spans per amendment v1.1), `strongs_lexicon`/`word_tags` (Strong's data, sourcing
  only so far — no UI yet, see Status)

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

## Seeding Strong's data

**Lexicon** (Strong's number → original word/transliteration/definition/derivation), from
[openscriptures/strongs](https://github.com/openscriptures/strongs) (CC-BY-SA, public-domain
1890 Strong's Concordance re-keyed to JSON):

```
python3 scripts/transform_strongs_lexicon.py
```

Produces `data/strongs_lexicon.csv` (14,197 rows). Import via Table Editor → `strongs_lexicon`.

**Word tagging** (which KJV word/phrase maps to which Strong's number, in actual KJV word order —
not a reordered Hebrew/Greek gloss), from
[scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)'s `KJVA-osis.json`
source, which mirrors CrossWire's KJV2003 Project data (OT tagging from The Bible Foundation, NT
from Dr. Maurice Robinson). **Licensing note:** this data is marked GPL by CrossWire and every
mirror of it; fine for personal use (where we are now), but revisit before distributing the app
to other users — see `spec-amendment` discussion in memory/session history if picking this back
up. Emailed CrossWire (`modules@crosswire.org`) for clarification; no response yet as of writing.

```
python3 scripts/transform_word_tags.py
```

Produces `data/word_tags_ot.csv` (227,196 rows) and `data/word_tags_nt.csv` (128,654 rows) —
parses the OSIS `<w lemma="strong:...">` tags, filters out the 14 apocryphal books KJVA includes
that our 66-book canon doesn't, zero parse failures across all 31,102 canonical verses. Split
OT/NT since 355,850 rows in one file is a much bigger import than anything so far — import each
separately via Table Editor, so a failed/timed-out import only means retrying one chunk.

**Two real import gotchas hit while first doing this, worth knowing about:**
- Make sure **`word_tags`** is the actually-selected table in the Table Editor sidebar before
  importing — the error "columns X, Y, Z are not present in your table" showed up because the
  CSV had gotten pointed at `verses` instead (whose columns partially overlap: both have
  `verse_id`/`translation_code`/`text`, which is exactly why only *some* columns were flagged).
- `strongs_ids` is a plain comma-separated `text` column (e.g. `"H853,H1254"`), not a Postgres
  `text[]` array, even though an array is the more natural type — Supabase's Table Editor CSV
  importer can't parse Postgres array-literal syntax (`{H853,H1254}`) and silently treats it as
  null, which then trips the not-null constraint. See migration 0006. Nothing queries this column
  at the SQL level yet, so the app-code (not SQL) parsing this implies is a fine tradeoff.

`position` is sequence order within the verse, not a character offset into `verses.text` —
aligning tagged phrases to exact spans in the rendered text is deferred to whichever session
builds the actual tap-word UI.

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
