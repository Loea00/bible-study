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
  (group-based spans per amendment v1.1), `strongs_lexicon`/`word_tags` (Strong's word-tap
  lexicon, live — see Status)

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

**Word-tap Strong's lexicon is live** (`src/features/reading/VerseText.tsx`,
`useWordTags.ts`, `LexiconCard.tsx`) — session 2 of the ~3-session split (source+import data →
tap-word UI+lexicon card → interaction redesign+concordance view), following data sourcing.
Every KJV word/phrase with a Strong's tag is individually tappable; taps open a card with the
original word, transliteration, definition, derivation, and KJV renderings for every Strong's
number attached (phrases mapping to multiple numbers, e.g. Gen.1.1's "created" → H853+H1254,
show all of them). `VerseText` reconstructs tappable spans by walking the verse text with a
cursor and matching each tagged phrase in sequence (word_tags stores order, not character
offsets — punctuation lives untagged between phrases in the source data, so offsets wouldn't
have reconstructed cleanly anyway); a tag that can't be found from the current cursor is skipped
rather than breaking the render.

**The text-selection interaction redesign (amendment v1.1 §A9) is now live** — session 3 of the
lexicon split. Notes and highlights are created by selecting text (drag, or tap a verse number for
the zero-drag whole-verse fast path), not by tapping the whole verse anymore:

- `selection.ts` maps the native browser `Selection`/`Range` onto `(verse_id, start_offset,
  end_offset)` spans, one per verse touched — computed by walking each verse's rendered text with
  a `TreeWalker` and counting characters, never trusting DOM node positions directly (word-tap
  `<span>` wrapping would throw raw DOM offsets off). Multi-verse selections work: each verse gets
  its own span, clamped to that verse's boundary.
- Releasing a selection shows `SelectionActionBar` — **Highlight · Note · Copy** (Reflect/Ask
  omitted; those features don't exist yet). Tapping a verse number selects that whole verse with
  zero dragging, per the spec's fast-path requirement.
- `useHighlights`/`useMarginNotes` now write real per-span offsets (previously always
  null/whole-verse). `VerseText` renders word-tap targets and highlight backgrounds in one unified
  pass — cuts the verse text at every span boundary from both sets and wraps each resulting
  segment in whichever applies, so a highlighted phrase still has working word-taps inside it.
- `VersePanel` is now **view + delete only** — tapping an *existing* mark (a note-dot, journal-dot,
  or a highlighted span) opens it to browse/remove; there's no creation UI left in the panel,
  since creation is exclusively the selection flow now.

**Real bug found and fixed during this work:** the action bar was `position: absolute`, which
silently resolved against the wrong containing block — visually close enough to look right in a
screenshot, but clicks landed on the passage text underneath instead of the bar. Switched to
`position: fixed`, which resolves directly against the viewport, matching what
`getBoundingClientRect()` already returns.

**Concordance view and "+Add" multi-select are now both live**, closing out the two pieces scoped
out of the interaction-redesign session:

- **Concordance** (`ConcordanceView.tsx`) — "Other occurrences →" on each lexicon entry in
  `LexiconCard` opens every other place in KJV that Strong's number appears, sorted in canonical
  book order then numeric chapter/verse, each a deep-link back into the reading view. Backed by a
  new `verses_for_strongs(target_id, max_results)` Postgres function
  (`supabase/migrations/0007_concordance.sql`, live — verified with real data, e.g. H7225 רֵאשִׁית
  returns 51 correctly-ordered occurrences) that does exact membership matching within
  `word_tags.strongs_ids`'s comma-separated text via `string_to_array(...) = any(...)`, avoiding
  `LIKE`-substring false positives (H430 matching H4300). Capped at 300 results, shown as "First
  300 occurrences" when hit. `LexiconCard` renders it as a sibling overlay, not a nested one — an
  earlier attempt at nesting meant closing the concordance card's own backdrop also closed the
  lexicon card underneath.
- **"+Add"** (spec amendment v1.1 §A9) — the `SelectionActionBar` now has a fourth action beside
  Highlight/Note/Copy. Clicking it holds the current selection in a `pendingGroup` (state lives in
  `ReadingView`) instead of committing it, so the next selection — anywhere else in the passage —
  can join it; a persistent `PendingGroupBar` at the bottom of the screen shows the running count
  and lets you commit the whole group as one highlight or note, or clear it. Spans held in the
  group render with a dashed underline (`.pending-mark`) distinct from the five highlight colors.
  No backend changes were needed — `createHighlight`/`addNote` already accepted arbitrary
  `SelectionSpan[]` groups from the interaction-redesign session.

**Search across own writing is now live** — a search box and topical-tag filter chips on the
journal timeline (`Journal.tsx`), scoped to journal entries per spec §5.2's "search + filter by
type/tag" line. Filters client-side against `title`/`body` (case-insensitive substring) and the
selected tag, combined with AND semantics when both are active. The search box shows whenever
there's at least one entry (independent of whether any entry has tags yet — an early version
gated the whole box on tag presence, which would've hidden text search entirely for anyone who
hadn't tagged anything, caught and fixed before shipping); tag chips only render once at least one
tag exists. Verified via temporary mock data injected into `useJournalEntries.ts` during testing
(reverted before commit, confirmed via `git diff` showing no changes) since this dev session has no
authenticated write path to create real entries to search.

**Three real bugs found via actual iPad use, all fixed:**

- **Only whole-verse highlighting worked on touch, never partial-verse drag-select.** Selection
  capture ran off the `mouseup` mouse event, which iOS Safari doesn't reliably fire when a
  drag-selection is finished via the native handle UI — the finger lifts off a system-drawn handle,
  not a DOM node, so no `mouseup` bubbles from anything. Verse-number tap (a plain `onClick`) was
  unaffected, which is why that path alone kept working. Fixed by switching to a debounced
  `document`-level `selectionchange` listener (`ReadingView.tsx`), which fires for both mouse and
  touch regardless of how the selection was finished. Verified no regression on desktop drag-select
  and verse-number tap.
- **Highlights were nearly impossible to remove.** Tapping highlighted text was opening the lexicon
  card instead of the verse panel. Root cause: `VerseText.tsx` wrapped overlapping segments in both
  the word-tap span and the highlight span, and word-tap's handler called `stopPropagation()`,
  always winning. Since nearly every KJV word carries a Strong's tag, a highlighted phrase is
  *mostly* word-tap surface — in practice, almost nowhere to tap that hit the highlight instead.
  First fixed by flipping the priority (highlight wins the tap); **superseded a day later** by the
  dot-based redesign below, once flipping priority the other way turned out to just trade the same
  problem for word-tap becoming unreachable on highlighted text instead (see next entry).
- **Extend a highlight, or add a note to an already-highlighted span.** Built as a first pass reusing
  `VersePanel`'s single-verse view with Extend/Remove actions and the `+Add` `pendingGroup` machinery
  for growing a highlight's spans (`useHighlights.ts`'s `getHighlightSpans`/`raw` state + a new
  `updateHighlight`, used in place of `createHighlight` while editing). Landed, but real laptop use
  turned up two follow-on problems addressed in the same session: (1) that single-verse `VersePanel`
  could only ever show the ONE verse tapped, not a non-consecutive highlight's other parts, so there
  was no way to see or note the "sum of the parts" of a multi-select highlight; (2) flipping
  highlight-tap to win over word-tap (previous entry) made lexicon lookups unreachable on any
  highlighted, word-tagged text — trading one unreachable feature for another.

  **Redesigned to separate the two concerns entirely** instead of having them compete for the same
  tap: word-tap now always wins on text (`VerseText.tsx` no longer gives highlight-mark spans a
  click handler at all — they're purely a background-color style now), and highlight management
  moved to a small dedicated indicator dot per verse per highlight group
  (`.verse-highlight-dot`, styled like the existing note-dot/journal-dot pattern), opening a new
  **`HighlightGroupPanel.tsx`** — not the per-verse `VersePanel`. It fetches and shows *every* span
  in the group in selection order, each with its own book/chapter/verse reference (via new shared
  `parseVerseId`/`formatReference` helpers promoted from `ConcordanceView.tsx` into `books.ts`,
  since this was the third place duplicating that logic), fetching verse text directly by verse_id
  rather than relying on whatever chapter happens to be open — correct even if a group's spans
  reach outside the current chapter. Extend/Note/Remove all act on the whole group: Note reuses
  `addNote(spans, ...)` fed from the group's exact spans (the "sum of the parts" note/reflect ask),
  Remove deletes the whole row (all spans go together, as already confirmed working), and Extend is
  unchanged from the first pass. `VersePanel` reverts to notes/journal only — it's deliberately
  single-verse-scoped and was never going to be able to represent a multi-verse group correctly.
  Verified end-to-end with a mock non-consecutive, multi-verse highlight (Gen.1.1 + Gen.1.3): the
  dot correctly opens a panel listing both pieces with their real references, word-tap on
  highlighted text opens the lexicon normally again, and Note opens the composer against both spans.

  **Not built:** "reflect on the sum of the parts" — reflection mode doesn't exist anywhere in the
  app yet (Phase 2/3 per spec); only the note half of that request was buildable today.

**Docked side-panel layout — chunk 1 of Reflection mode (§5.3) — is now live.**
Every piece of "content connected to a verse" (`VersePanel`, `HighlightGroupPanel`) used to render
as a centered modal overlay covering the passage. That never matched spec §5.1's actual design
("tapping a marked verse opens a panel... Mobile: side panel becomes a bottom sheet") or §5.3's
Reflection mode ("Text slides aside; a writing page opens beside it. The passage stays pinned and
readable while writing") — everything was a full-screen dim overlay, none of it docked. Aaron
remembered the original side-panel design conversation and asked whether the true docked layout was
buildable; this is the layout groundwork, landed as its own chunk before Reflection mode itself
(chunk 2) is built on top of it.

`ReadingView.tsx` is now a flex row: `.reading-pane` (the passage, keeps its familiar ~720px reading
width via its own padding) and `.reading-side-panel`, which collapses to *zero* width — not reserved
empty space — when nothing is selected, and opens to a docked 380px column on tap. On narrow
viewports it switches to a fixed bottom sheet instead (slides up, rounded top corners, matching
spec's mobile behavior). The global `main` element's old `max-width: 720px` (previously shared by
every route) moved onto each page's own root class (`.journal`, `.reading-log`) so the reading view
could go full-bleed without affecting Journal or the reading log.

`VersePanel`/`HighlightGroupPanel` no longer wrap themselves in `.picker-overlay` — they're now
plain content rendered inside the dock, with a new `.side-panel-body` class replacing `.verse-panel`'s
box-model (max-width/max-height/background/border), since the dock itself now owns sizing and
scrolling; `NoteComposer`/`LexiconCard`/`PassagePicker`/`ConcordanceView` are untouched and still
float as modals (deliberately — see the "what's out of scope" note in the plan file if resuming this
work later). `ReadingView`'s three separate note/highlight-viewer states collapsed into one
`SidePanelState` discriminated union (`{mode:'verse'|'highlight', ...} | null`) so exactly one thing
renders in the dock at a time. Verified in-browser: `/journal` and `/log` unaffected (still
centered), reading view full-width by default, highlight-dot correctly opens the dock without
covering the passage, drag-select/floating action bar unaffected, and the mobile bottom-sheet
transition confirmed at a 400px viewport.

**Reflection mode (spec §5.3) — chunk 2 — is now live.** Selecting a passage and hitting the new
**Reflect** button on the selection action bar (alongside Highlight/Note/Copy/+Add) opens a new
`ReflectionComposer.tsx` in the docked side panel from chunk 1 — title (optional) + a free-write
body, no manual tagging. Anchoring is fully automatic: the exact spans the passage was selected with
(folding in any `+Add` group, same as Note) become `verse_references` rows with `ref_kind: 'anchor'`,
same shape `useMarginNotes.ts` already writes for margin notes. Inline `@Book chapter:verse` tags to
*other* passages within the reflection body still work — same `parseVerseTags` mechanism the journal
editor uses, written as separate `ref_kind: 'inline'` rows. Both the anchor insert and the inline-tag
insert, plus the `entries` row itself (`entry_type: 'reflection'`), needed zero schema changes —
both values were already valid in the Phase 1 check constraints, just never written by any UI until
now.

New `useReflections.ts` hook exposes `reflectionsByVerse` (fetched by joining `verse_references`
where `ref_kind='anchor'` to `entries` where `entry_type='reflection'` — the same two-step shape
`useJournalExcerpts.ts` already uses for inline tags — needed since a reflection's anchor can span
multiple verses, not just the one verse `entries.anchor_start` stores) and `addReflection`.
`VersePanel` gained a third "Reflections" section (title + first ~140 characters + "Open full
entry", same visual treatment as the existing Journal-excerpts section). Per spec, margin notes and
reflections share the same verse indicator — the existing `.verse-note-dot` — rather than a new dot
color, since spec's own icon language groups them ("note icon = margin notes/reflections").

Verified end-to-end in-browser: selecting a passage and clicking Reflect opens "Reflecting on
Genesis 1:3" in the dock with the passage still fully visible and scrollable on the left; word-tap
on the passage still opens the lexicon normally while the composer is open (spec's "lexicon works
mid-composition"), confirming the earlier decision to keep lexicon a separate floating overlay
rather than folding it into the dock was the right call; typing a body and clicking "Save reflection"
correctly reaches `addReflection`'s auth check ("Not signed in" — expected, no authenticated session
in this working environment, same known limitation as every other write path built this session);
`VersePanel`'s new Reflections section confirmed rendering via temporarily-mocked data, cleanly
reverted before commit.

**Journal timeline reflection support — chunk 3, closing out the docked-layout + Reflection mode
plan — is now live.** `useJournalEntries.ts`'s fetch generalized from `.eq('entry_type', 'journal')`
to `.in('entry_type', ['journal', 'reflection'])` (its write path, `createEntry`, stays
journal-only — reflections are authored via `useReflections.addReflection` instead, a separate
insert with different anchor semantics). `Journal.tsx` gained an "All / Journal / Reflection"
filter-chip row, satisfying spec §5.3's "in the journal timeline as a filterable type," combining
with the existing search/tag filters via AND semantics. `JournalEntryCard.tsx` gets a small
"REFLECTION" badge when `entry_type === 'reflection'` — a text badge rather than a literal icon,
matching the app's existing icon-light visual language. Verified end-to-end with mock journal +
reflection entries: both entry types appear together by default, the Reflection filter correctly
isolates just the reflection with its badge, cleanly reverted before commit.

**This closes out the full 3-chunk plan** (docked side-panel layout → Reflection mode → Journal
timeline support) that started from Aaron asking whether the reading-pane-plus-subordinate-panel
layout he remembered from an earlier design conversation was buildable. Full plan file at
`.claude/plans/expressive-zooming-galaxy.md`.

Still ahead in Phase 2: calendar, reading plans, TSK cross-references, "Today, I..." templates.

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
