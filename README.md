# Bible Study App

Phase 1 scaffold: React + TypeScript (Vite) frontend, Supabase (Postgres/auth) backend. See
`bible-study-app-spec.md` for the full product spec, plus `spec-amendment-v1-1-highlights.md`
(span anchoring, unified across notes/highlights/journal tags), `spec-amendment-v1-2-prayer-social.md`
(Phase 2+ prayer system, AI grounding, social — core prayer tracker now in progress, see Status;
AI grounding and social sharing are still roadmap only), and `spec-amendment-v1-4-theming.md`
(token-based theme system, 4 themes + light/dark — **designed, deliberately not started**; see
TODO below).

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
- `src/features/highlights/` — all-highlights list (`/highlights`)
- `src/features/prayer/` — prayer tracker (`/prayer`) — lists, requests, status (see Status)
- `supabase/migrations/` — schema: `entries`, `verse_references`, `reading_sessions` (user
  content), `translations`/`verses` (bundled public-domain reference text), `highlights`
  (group-based spans per amendment v1.1), `strongs_lexicon`/`word_tags` (Strong's word-tap
  lexicon, live — see Status), `prayer_lists`/`prayer_requests`/`prayed_marks` (prayer tracker
  core per amendment v1.2, see Status)

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

## Seeding TSK cross-references

**Treasury of Scripture Knowledge**, from the CrossWire SWORD module (confirmed
`DistributionLicense=Public Domain` directly in the module's own `mods.d/tsk.conf` — genuinely
public domain, not the CC-BY openbible.info compilation that was considered and rejected first).
No off-the-shelf reader exists for this format (it's a "zCom" commentary module; `pysword` only
reads Bible-type "ztext" modules), so `scripts/transform_tsk.py` hand-decodes the binary index
files — see the script's own docstring for the exact byte layout.

```
python3 scripts/transform_tsk.py
```

Requires `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in the environment (it cross-checks its
walk against the already-imported `verses` table's chapter/verse counts rather than a guessed
versification table). Downloads and caches `data/TSK.zip`, produces `data/tsk_cross_references.csv`
(`from_verse_id,to_verse_start,to_verse_end`) — **all 66 books, 362,504 rows.** See Status for the
data-fidelity note (a real drift bug was found and fixed after the first pass, and a small ~0.1%
residual tail gap remains, deliberately left as-is rather than chased further).

**To get this live**, since only the anon key is available in this environment (no DDL/service-role
credentials):
1. Run `supabase/migrations/0009_tsk_cross_references.sql` via the Supabase SQL Editor — creates
   `tsk_cross_references` with the same open-read RLS policy as `strongs_lexicon`/`word_tags`.
2. Import `data/tsk_cross_references.csv` via Table Editor → `tsk_cross_references` → Import data
   from CSV. At 362,504 rows / ~10 MB, this is roughly the same order of magnitude as the
   `word_tags_ot.csv` import (227,196 rows) that worked fine in one pass — but if the importer
   times out or stalls, split it first (`split -l 100000 data/tsk_cross_references.csv
   data/tsk_chunk_`, re-add the CSV header to each chunk, import one chunk at a time) rather than
   troubleshooting a single giant import.

## Seeding commentary data

**Matthew Henry's Concise Commentary (MHCC)**, from the CrossWire SWORD module (confirmed
`DistributionLicense=Public Domain` in the module's own `mods.d/mhcc.conf` — "Public Domain--Copy
Freely"). First of the three spec-named commentaries (Matthew Henry, Barnes, JFB — see spec §102);
staged one at a time per the agreed approach, MHCC picked first since its per-verse structure is
closest to TSK's, letting the extraction reuse the same zCom-decoding approach.

```
python3 scripts/transform_mhcc.py
```

Requires `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (same chapter/verse ground-truth pattern as
TSK). Produces `data/mhcc_commentary.csv` (`source,verse_start,verse_end,body`) — **4,047 entries
across all 66 books.**

**A real, non-trivial bug was found and fixed while building this** (not just a residual gap like
TSK's): the zCom format here has an extra wrinkle TSK didn't — chapters are preceded by junk
*empty* index slots in addition to a `<chapter n="N">` marker, and the first version of the walk
miscounted those empty slots as verse content. That silently ate into each chapter's verse budget
before its real content even started, so the chapter's walk ran out of budget partway through its
*actual* verses — Psalm 23:1 was showing Psalm 22's commentary, one whole chapter behind. Root
cause and fix confirmed by direct byte inspection of the Job 41→42 and Psalm 21→22→23 boundaries
(see `scripts/transform_mhcc.py`'s docstring/comments). The fix makes each chapter actively *seek*
its own header (skipping any junk, empty or not, without counting it) rather than trusting
cumulative cursor arithmetic — self-correcting at every chapter boundary. Re-verified after the fix
against Genesis 1:1, Psalm 22:1, Psalm 23:1, John 1:1, Romans 8:28, Ephesians 2:8, Revelation
22:21, and Malachi 4:6 — all correct. One accepted content gap, not an extraction bug: John
3:9-21 (including 3:16) has no MHCC entry at all — confirmed via direct byte inspection that the
module's own index slots for that range are genuinely empty, not a walk error; the concise edition
apparently just doesn't comment on that section individually.

**To get this live**, same anon-key-only constraint as everything else: run
`supabase/migrations/0011_commentary_entries.sql` via the SQL Editor, then import
`data/mhcc_commentary.csv` via Table Editor → `commentary_entries`. At 4,047 rows / ~4 MB this is
small — no chunking should be needed.

**Jamieson-Fausset-Brown Commentary (JFB)**, second of the three planned commentaries, from the
CrossWire SWORD module (confirmed `DistributionLicense=Public Domain` in `mods.d/jfb.conf`).

```
python3 scripts/transform_jfb.py
```

**A real format surprise**: JFB's `ModDrv` is `zCom4`, not plain `zCom` like TSK/MHCC — a
different binary layout, not just a naming quirk. Its verse-index files (`.bzv`) use **12-byte
entries** (`blocknum:u32, start:u32, length:u32`) instead of zCom's 10-byte entries
(`blocknum:u32, start:u32, length:u16`). Caught by noticing `nt.bzv`'s file size (98,952 bytes)
doesn't divide evenly by 10 but does by 12, and that `289,380 / 12 = 24,115` and
`98,952 / 12 = 8,246` exactly match the already-known OT/NT total slot counts. Full byte-format
notes are in `scripts/transform_jfb.py`'s docstring. The same self-correcting "seek each chapter's
header" walk from MHCC (see above) carried over unchanged and worked cleanly on the first real
run — no desync bug this time.

Content structure differs from MHCC too: no "Chapter Outline" table (confirmed absent by grepping
200 real entries for `<table`), but section headers
(`Ge 1:3-5. The First Day.`) and **per-verse key-phrase labels**
(`2. the earth was without form and void--`) that are genuinely useful inline content, kept rather
than stripped like MHCC's redundant "Verses N-M" labels were. Also caught and fixed a real text
bug while spot-checking (`&amp;c.` showing up instead of `&c.` — unescaped HTML entities leaking
through raw tag-stripping) and applied the same fix retroactively to `transform_mhcc.py`, since it
had 7 of the same leftover entities.

Produces `data/jfb_commentary.csv` (`source,verse_start,verse_end,body`) — **16,882 entries (11,886
OT + 4,996 NT) across all 66 books.** Spot-checked Genesis 1:1, Genesis 1:3, Psalm 23:1, John 3:16,
Revelation 22:21 — all correct, all richer/more granular than MHCC's concise treatment (JFB is a
full scholarly commentary, not a concise digest).

**To get this live**: import into the same `commentary_entries` table — no new migration needed,
`source='JFB'` alongside the existing `'MHCC'` rows. Import `data/jfb_commentary.csv` via Table
Editor. At 16,882 rows / ~11 MB, smaller row-count than TSK's 362K-row import that worked fine in
one pass — should be straightforward.

## Seeding Barnes' Notes

**Barnes' Notes on the New Testament**, third and final of the three planned commentaries, from the
CrossWire SWORD module (confirmed `DistributionLicense=Public Domain` in `mods.d/barnes.conf`).
NT-only — there is no OT edition.

```
python3 scripts/transform_barnes.py
```

Plain `zCom` binary format again (not JFB's `zCom4`) — confirmed via the standard divisibility
check: `nt.czs` (3,120 bytes) / 12 = 260, matching the NT's known 260 total chapters; `nt.czv`
(82,460 bytes) / 10 = 8,246, matching the known NT verse-slot count. But `barnes.conf` also
declares `BlockType=CHAPTER` (not `BOOK` like TSK/MHCC/JFB) and `SourceType=ThML` (not OSIS) — both
real structural differences that broke the MHCC/JFB "seek a `<chapter n="N">` header, then walk
n_verses slots" approach entirely: there's no dedicated header slot at all, and — confirmed by
direct inspection — a new chapter is signalled purely by the verse-index entry's blocknum
incrementing by one, with exactly one block per NT chapter, assigned sequentially in canonical
book/chapter order (block 0 = Matthew 1, block 1 = Matthew 2, ... block 259 = Revelation 22) — the
260-chapter/260-block match above guarantees this holds globally.

Entries also aren't strictly one-per-verse (Matthew 1 has 25 verses but only ~24 real content
slots — Barnes wrote one combined "Verses 2-16" note while separately commenting on verse 23
twice). Rather than reconstruct verse numbers from position, every real entry's own text opens with
an explicit label ("Verse 4.", "Verses 22, 23.", "Ver 23."), sometimes behind redundant title junk
("Matthew Verses 2-16 ... Verses 2-16. These verses...") or a free-text chapter header folded into
verse 1's own slot ("MATTHEW Chapter 2 ... Verse 1. ..."). `transform_barnes.py` parses the verse
range straight from each entry's own content (the last label match in its leading ~250 characters)
instead of cursor-walking — sidesteps the whole empty-slot/leading-junk alignment problem that
MHCC/JFB needed a self-correcting walk for, since Barnes' content itself is the source of truth.
Full byte-format and parsing notes are in the script's docstring.

Content markup is ThML, a third distinct format for this project (`<br />`, `<i>...</i>`,
`<scripRef version="Barnes" passage="Mt 1:3">Mt 1:3</scripRef>` with short abbreviated passage
text, not resolved OSIS) — same tag-strip-to-plain-text treatment as everywhere else, `html.unescape`
included from the start this time.

Produces `data/barnes_commentary.csv` (`source,verse_start,verse_end,body`) — **7,271 entries
across all 27 NT books, zero parse warnings.** Spot-checked Matthew 1:17, 1:25, 2:1, 28:20, John
3:16, Romans (front matter only, no verse 1 comment — Barnes' own choice, not a bug), Revelation
22:21 — all correct. No leftover tags or HTML entities in a full-file scan.

**To get this live**: import into the same `commentary_entries` table — no new migration needed,
`source='BARNES'` alongside the existing `'MHCC'`/`'JFB'` rows. Import `data/barnes_commentary.csv`
via Table Editor. At 7,271 rows / ~13 MB, smaller row-count than JFB's — should be straightforward
in one pass. Per the JFB partial-duplicate-import lesson: after importing, verify the live
`source=eq.BARNES` count matches 7,271 exactly and spot-check across the full NT range (not just
Matthew), not just a rough "looks right" glance.

## Seeding Nave's Topical Bible

**Nave's Topical Bible**, from the CrossWire SWORD module (confirmed `DistributionLicense=Public
Domain` in the module's own `mods.d/nave.conf`). Spec §4.3 "topic → verse lists"; also planned as
Layer 1 of the prayer tracker's AI-grounding design (free, offline topic-matching before ever
reaching a paid AI call).

```
python3 scripts/transform_nave.py
```

This is a **different SWORD binary format** from TSK/MHCC — "zLD" (compressed lexicon/dictionary),
not "zCom" (verse-keyed commentary). Key-keyed rather than verse-keyed: a `dict.dat` file lists
every topic (`KEY\r\n` + blocknum + entry-index, already alphabetical), pointing into
zlib-compressed blocks (`dict.zdt`, indexed by `dict.zdx`). One real format surprise hand-decoded
along the way: `dict.zdx`'s block index is **8 bytes/entry** (offset + compressed size only), not
zCom's 12-byte (offset + compressed size + uncompressed size) — decompression failed on the second
block until this was caught (confirmed via `1424 % 12 != 0` but `1424 % 8 == 0` for this module's
index file size). Full byte-format details are in `scripts/transform_nave.py`'s docstring.

Much simpler content parsing than TSK, though: scripture references are markup as
`<ref osisRef="Exod.6.16-Exod.6.20">Ex 6:16-20</ref>` — fully resolved OSIS references, no
citation-shorthand book/chapter-carry-forward parsing needed the way TSK required. Each topic's
entry is a set of `<lb/>`-delimited lines, each with a descriptive label ("Marriage of", "Death and
burial of") — preserved as its own `label` column since it's genuine structure from the source
(matches how Nave's own printed edition organizes a topic), not just noise.

Produces `data/nave_topics.csv` (`topic,label,verse_start,verse_end`) — **5,322 topics, 77,922
verse-reference rows.** 26 references to apocryphal books (Prayer of Azariah, Wisdom of Solomon —
outside our 66-book canon) were correctly skipped, not crashed on, matching the established
`word_tags` precedent for KJVA's apocryphal content. ~650 topics produced zero verse rows (pure
cross-reference/alias entries, e.g. "AARON, Death of. See AARON") — not resolved further, accepted
as v1 scope same as TSK's residual gap.

**To get this live**: run `supabase/migrations/0012_nave_topics.sql` via the SQL Editor (also adds
`search_nave_topics()`, a small RPC for distinct topic-name search — plain PostgREST `select()` has
no `DISTINCT`, and a popular topic like FAITH has hundreds of rows, so a naive query would return
heavily duplicated topic strings), then import `data/nave_topics.csv` via Table Editor →
`nave_topics`. At 77,922 rows / ~4.4 MB, comparable in row-count to TSK — should be fine in one
pass, but split with `split -l 100000` first if the importer stalls.

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
indicator per type in the running text.

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

**Follow-up bug report from Aaron's live use, three fixes plus one new capability, all
browser-verified this time (not just build-checked):**

- **New: quoted scripture visible next to notes/reflections, expandable.** New shared
  `AnchorScripture.tsx` component — a "Show scripture ▾" toggle that, on first expand, fetches
  every `verse_references` row for that entry (`ref_kind='anchor'`), sorted canonically (new
  `compareVerseIds` in `books.ts` — proper Bible order, not lexicographic string sort, promoted
  out of `ConcordanceView.tsx`'s local copy since this made a third use), then the matching verse
  text, and renders each piece with its own reference. Wired into both `JournalEntryCard.tsx`
  (reflections) and `VersePanel.tsx` (both margin notes and reflections) — the same "sum of the
  parts" need HighlightGroupPanel already solved for highlights, now solved for notes/reflections
  too, and in the *same space* the note/reflection itself is shown, not a separate navigation away.
- **Fixed — a note/reflection dot only showed the one verse next to it, not the whole group.**
  Root cause: `VersePanel` is deliberately single-verse-scoped (by design, since it also holds
  distinct notes per verse), so even after the `useMarginNotes` anchor-read fix, opening it from
  any one dot only ever showed that verse's own text — never the *other* verses the same
  note/reflection touched. `AnchorScripture` above is the fix: every note and reflection listed in
  `VersePanel` now has its own expandable "show every linked verse," regardless of which dot opened
  the panel.
- **Fixed — no way to dismiss `SelectionActionBar` without completing an action.** Found while
  investigating Aaron's "no way to close the panel" report: the bar received an `onClose` prop but
  never rendered a button for it — the only way out was Highlight/Note/Reflect/Copy succeeding, or
  `+Add`. Added an explicit "×" dismiss button. (`HighlightGroupPanel`'s own Close button, which
  Aaron named specifically, was checked live and already worked correctly — this dismiss gap was
  the more likely real culprit for the "stuck, can't back out" experience.)

**New `/highlights` page — a running list of every highlight, across the whole Bible, not scoped to
whatever chapter is currently open.** Requested directly: "a section that lists all of the
highlights." New `src/features/highlights/` — `useAllHighlights.ts` fetches every `highlights` row
unscoped (most-recent-first) plus the quoted text for every span across every highlight in one
batched pass, grouped by translation (a highlight's own `translation` field, not the reading view's
current one, since this page has no reading-view context) since different highlights could in
principle have been made in different translations. `HighlightsPage.tsx` renders each as a card:
color swatch, "N parts," an "Open in reading view →" deep link (to the first span's book/chapter),
every piece with its own reference + quoted text (same visual pattern as `HighlightGroupPanel`/
`AnchorScripture`), and a Remove button. New nav link between Journal and Log. Verified end-to-end
with mock multi-part and single-part highlights: real KJV verse text pulled correctly for both,
deep links resolve to the right chapter, empty state shows correctly with no highlights, mock
cleanly reverted before commit (confirmed via grep, since it's a new untracked file `git diff`
wouldn't show).

**Verse indicators are real icons now, not all dots.** Highlights stay as color dots (the point
there is color, per spec amendment v1.1 §A6); notes/reflections and journal mentions moved to
actual icons — a small pencil glyph and a small book glyph — per spec §5.1's original "note icon /
notebook icon" language, which Phase 1 had simplified away to plain dots for all three. New
`VerseIndicatorIcons.tsx` (hand-written inline SVG, no icon library added). Verified live with all
three indicator types rendering together on different verses of the same chapter.

**Reflections got their own icon (heart), separate from margin notes (pencil).** Aaron: notes are
"scholastic," reflections are "experiential or opinion" — sharing one icon (per spec §5.1's literal
"note icon = margin notes/reflections" grouping) undersold that real distinction. `ReadingView.tsx`
now renders two independent conditions/icons instead of one combined one; a verse can show both at
once if it has both. New `ReflectionIcon` in `VerseIndicatorIcons.tsx`, colored via
`--highlight-pink` (warmer than the note icon's `--accent`) for an extra, non-shape signal.

**Journal entries, reflections, and margin notes are all editable now** — previously create + delete
only. `useJournalEntries.ts` gained `updateEntry(entryId, title, body, tags)`, which works for both
`entry_type`s since editing never touches `anchor_start`/`anchor_end` or the `ref_kind='anchor'`
verse_references a reflection's passage anchor depends on — it only reconciles inline `@verse` tags
(delete the old `ref_kind='inline'` rows, re-insert from the new body) alongside the title/body/tags
update. `JournalEntryCard.tsx` gets an Edit button that swaps the card into the same field set as
the top-of-page composer, with Save/Cancel. `useMarginNotes.ts` gained `updateNote(entryId, body)` —
simpler, since a note's anchor spans are immutable by design (remove-and-recreate is the model, same
as highlights) and notes don't carry inline tags. `VersePanel.tsx`'s margin-notes list was refactored
into a `NoteItem` sub-component so each note manages its own edit/delete/error state independently
rather than sharing one set of state across the whole list. Reflections are edited via the Journal
page (same `JournalEntryCard` mechanism already covers them) — `VersePanel`'s Reflections section
stays view-only with its existing "Open full entry" link, not a second edit surface. Verified live
with mocked data end-to-end for all three: note edit, journal entry edit (including an inline
`@Gen 1:1` tag correctly re-resolving after save), reflection/note icon split rendering distinctly
side by side.

**Prayer tracker core has started** (spec-amendment-v1-2 §B2, staged build: schema+CRUD+page →
prayed_marks gesture+answered ledger → entries integration — this is stage one). New migration
`0008_prayer_core.sql` adds `prayer_lists` (user-defined groupings), `prayer_requests` (title,
description, `status` — active/ongoing/answered/archived — `answered_note`, plus a `visibility`
column and `grounding`/`grounding_generated_at` columns that ship now but stay unused until Phase
3/4 AI grounding and social sharing, per the amendment's "no later migration is disruptive" rule),
and `prayed_marks` (the one-tap "I prayed for this," schema-only for now — no UI yet, that's stage
two). `entries` gained a nullable `request_id` and three new `entry_type` values (`prayer_update`,
`word`, `concern`) for prayer-attached writing, also schema-only until stage three wires it up.
New `/prayer` route (`src/features/prayer/`): `usePrayerLists.ts`/`usePrayerRequests.ts` (CRUD
hooks matching the `useHighlights`/`useAllHighlights` conventions), `PrayerPage.tsx` (composer,
list management with inline rename, status filter chips — Open/Answered/Archived/All — requests
grouped by list), `PrayerRequestCard.tsx` (edit, status-transition buttons per current status, an
inline answer-note form for marking answered, delete). Verified live with mocked lists/requests:
grouping by list plus an Unlisted bucket, status badges and filter chips, the edit form correctly
pre-selecting the request's current list, the "mark answered" inline note form, and list rename —
all cleanly reverted before commit.

**Prayer tracker stage two: the prayed-mark gesture and "pray through my list" flow are live**
(spec-amendment-v1-2 §B3/§B4). New `usePrayedMarks.ts` hook — one-tap, writing-free by design
(timestamp + optional `session_id` link to the active reading session, no note), fetched unscoped
and grouped by request like the other Phase-2-scale hooks. `PrayerRequestCard.tsx` gained an "I
prayed for this" button, a soft relative-time "Last prayed…" whisper, and a quiet dot-strip
timeline (§B3: "a quiet visual rhythm, not a ledger of numbers") — deliberately no numeric mark
count shown next to the button itself. New `PrayThroughFlow.tsx`: steps through one list's open
(active/ongoing) requests at a time, sorted least-recently-prayed-first so untouched requests
surface naturally (a gentle nudge, not guilt — §B3's "quiet daily view" principle folded into
ordering rather than a separate surface); mark-and-advance, Skip, or Exit anytime; ends with a
plain "That's everyone in {list}." statement, no completion framing, no checklist scoring, per
spec's explicit "not a checklist grind." `PrayerPage.tsx` gained a "Pray through {list} (N)" button
row, independent of the status filter (so it's still reachable while viewing Answered/Archived).
The spec's "answered ledger" (§B3) is already satisfied by the existing Answered status filter from
stage one — spec calls this out as "a Phase 2 freebie (it is a status filter)," so no separate view
was built. A full request-detail page (§B3's "fifth lens" — prayed timeline + interleaved history
as its own route) is deferred; today's card carries the same information compactly. Verified live
with mocked lists/requests/marks: dot-strip count, last-prayed whisper, pray-through buttons only
appearing for lists with open requests, the full flow (progress counter, Skip advancing, the quiet
completion state, Exit/Done returning cleanly to the page) — reverted cleanly before commit.

**Prayer requests now have a lifecycle history** (spec-amendment-v1-2 §B2/§B3, stage three, prompted
by Aaron wanting a way to capture insight that comes while meditating/praying on a request over
days or longer — this is what `entries.request_id` and the `prayer_update`/`word`/`concern` entry
types were already reserved for). New `usePrayerEntries.ts` (request-scoped CRUD, chronological
oldest-first since it's a narrative, not a feed) and `PrayerRequestHistory.tsx`, an expandable
section on each request card (▾ Show history, matching `AnchorScripture`'s expand pattern — lazy-
fetches only once opened) with a small composer (pick Update/Word/Concern, write, save) and the
existing entries listed with edit/delete. Entries support the same `@Book chapter:verse` inline
tagging journal entries do — cross-referencing scripture was free to add by reusing
`parseVerseTags`/`EntryBody`, not a new system. **Confirmed for the record: prayer requests never
disappear on their own** — `answered`/`archived` only change the `status` column; the row and
everything attached to it persist until an explicit Delete.

Prayer-attached entries also now fold into the **Journal timeline** (`useJournalEntries.ts` fetch
widened to include the three new types), reusing its existing search box and gaining a new
"Prayer" filter chip, a type badge (Update/Word/Concern), and a "From: {request title} →" link
back to `/prayer` (resolved via new `usePrayerRequestTitles.ts`, a lightweight id→title lookup —
no join needed). This is deliberately how "searchable and cross-referenced" was satisfied: one
shared search surface across journal/reflection/prayer writing, rather than a second search UI
built just for prayer. **Explicitly deferred** (noted so it isn't forgotten, not silently dropped):
surfacing these entries in the reading view's verse side panel and in reading-log session
summaries ("prayed for 2 requests") — both are real spec items (§B3's cross-surface integration
list) but are reading-feature integration points, not part of this round. Verified live with mocks
across all three files: history composer + chronological list + inline verse-tag resolution on the
Prayer page, and the Journal fold-in (badge, back-link, filter chip) — reverted cleanly, build
clean, committed and pushed.

**Both deferred cross-surface integrations from stage three are now done** (spec-amendment-v1-2
§B3's list) — this closes out the prayer tracker's Phase 2 core entirely. `useJournalExcerpts.ts`
now also picks up prayer-attached entries (they have no anchor of their own, so an inline `@verse`
tag is the only way one can surface in a verse's side panel — the mechanism was already there,
just scoped to `entry_type: 'journal'` only). `VersePanel.tsx` splits the result into two sections
by type: "Journal" stays as before, a new "Prayer" section shows the entry's kind
(Update/Word/Concern), its excerpt, and a "From: {request title} →" link back to `/prayer`
(resolved via the same `usePrayerRequestTitles.ts` from the Journal integration — no new fetch
pattern). Separately, `useReadingLog.ts` gained `loadSessionPrayedMarks`, and expanding a session
in the reading log now shows "Prayed for N requests" (counting *distinct requests*, not raw taps)
above its entry list when marks happened during that session — the reading log's entry-type label
was also a binary `isNote ? 'Note' : 'Journal'` before this, silently mislabeling reflections and
now prayer entries too; fixed with a proper label map (`Note`/`Journal`/`Reflection`/`Update`/
`Word`/`Concern`) while in the file. Verified live with mocks: the verse panel's Prayer section on
a real Genesis 1:1 with a mocked `@verse`-tagged Word entry, and the reading log's prayed-count
line on a mocked session — reverted cleanly, build clean, committed and pushed.

**Inline `@verse` tags now support ranges** — `@1 Cor 6:19-20` and `@1 Cor 6:19&20` both tag verses
19 *and* 20, not just 19. `verseTagParser.ts`'s `TAG_PATTERN` gained an optional trailing
`[-&]<verse>` group (capped at a 50-verse span so a stray "-2026" typo can't silently explode into
dozens of tagged verses); `ParsedTag` changed from a single `verse`/`verseId` to `verseStart`/
`verseEnd`/`verseIds: string[]`. Every consumer of the old shape was updated: `VerseTagChip.tsx`
now renders a range reference ("1 Corinthians 6:19-20") and fetches+joins every verse's text in
order (`.in('verse_id', verseIds)` doesn't preserve order, so the join is done by walking
`verseIds` after the fetch, not by trusting row order back). The three insert sites
(`useJournalEntries.ts`, `useReflections.ts`, `usePrayerEntries.ts`) now `flatMap` each tag's
`verseIds` into one `verse_references` row per verse (same `entry_id`/`position`, following the
existing convention — every ref_kind, anchor or inline, already represents multi-verse coverage as
N single-verse rows, never a genuine start≠end range row, so this reuses that pattern rather than
inventing a new one). `useJournalExcerpts.ts`'s match condition changed from an equality check
(`t.verseId === ref.verse_start`) to membership (`t.verseIds.includes(ref.verse_start)`) so a
range-tagged entry correctly surfaces in *every* covered verse's side panel, not just the first.
**Generalized further same day: `@verse` tags now support full comma/&-separated lists, including
non-consecutive verses and mixed ranges+singles** — `@Gen 1:1,3&5` and `@Gen 1:1-4,5&7` both work,
not just a plain `N-M` range. `ParsedTag` changed again from `verseStart`/`verseEnd` to
`verseNumbers: number[]` (sorted, deduplicated — an overlapping list like `1-4,3&5` collapses
cleanly rather than double-inserting verse 3). New `expandVerseList()` tokenizes on `,`/`&`, expands
any `N-M` token, dedupes and sorts; new exported `formatVerseRanges()` re-compresses the sorted list
back into a clean canonical display (`[1,2,3,4,5,7]` → `"1-5, 7"`) regardless of how the user
actually typed it — mixed separators, out of order, overlapping ranges all normalize to the same
tidy chip text. `VerseTagChip.tsx` and `EntryBody.tsx` updated to the new shape; the three insert
sites and `useJournalExcerpts.ts`'s match were untouched this round since they only ever depended
on `.verseIds`/`.start`, which didn't change shape. Comma was deliberately NOT added as a range
separator (only `-`) — `1,3` means two singles, `1-3` means a range; conflating them would make
`1,3-5` ambiguous. Verified live: `@Gen 1:1,3&5` → "Genesis 1:1, 3, 5", `@Gen 1:1-4,5&7` → "Genesis
1:1-5, 7" (5 correctly merges into the preceding range), a plain `@Gen 1:2` still works, and
clicking the 6-verse chip fetched and joined all six verses' real text in order, correctly skipping
verse 6 — reverted cleanly, build clean, committed and pushed.

**TSK cross-reference sourcing is complete** (biggest lift of the remaining Phase 2 items — this
was sourcing only, per the plan; schema/import/UI panel still ahead). First had to pick a real
data source: the obvious fast path (`scrollmapper/bible_databases`'s `sources/extras/
cross_references.txt`, same repo already trusted for KJV/ASV) turned out to be openbible.info's
compiled-and-voted dataset — CC-BY, not public domain, and only ~345k rows against the spec's
"~640k." Went with the real public-domain source instead: the CrossWire SWORD `TSK` module,
confirmed `DistributionLicense=Public Domain` directly in its own `mods.d/tsk.conf`.

No existing tool reads this module's format (`pysword` only supports Bible-type "ztext" modules,
not "zCom" commentaries), so `scripts/transform_tsk.py` hand-decodes the binary index files —
block index (12 bytes: offset/compressed-size/uncompressed-size), verse index (10 bytes: block
number/start offset/length), zlib-compressed per-book blocks. Chapter/verse *counts* come from our
own already-imported `verses` table (queried live via the anon key) rather than a guessed
versification table — this is what let a real bug surface across two rounds:

- **Round one** (first session): assumed each chapter has at most one "outline" header
  (self-identifying `<scripRef passage="Ge 2:1">`) at its very start. Genesis validated perfectly
  against this model (all 50 chapters), so it shipped as "Genesis–Job + NT verified, Psalms
  onward excluded" — but that model was wrong, just wrong in a way Genesis happened not to expose.
- **Round two** (this session): direct byte inspection of Exodus found **four** separate
  `passage=` header anchors within chapter 1 alone (Ex 1:1, 1:8, 1:15, 1:22 — one per narrative
  section break, each followed by that section's real verse content). Headers aren't
  one-per-chapter at all; they can appear anywhere, including never. The walk was rewritten to
  peek *every* slot (not just the first one per chapter) and skip any that look like a header,
  however many a chapter has. Re-verified against known content across the *whole* Bible this
  time, not just Genesis — Psalm 23:1, Psalm 100:1, Isaiah 53:5, and John 3:16 all pulled
  semantically correct cross-references (e.g. Isa 53:5's "wounded for our transgressions" pulling
  in Lamentations' lament verses).

Result: **all 66 books, 362,504 cross-reference rows**, `data/tsk_cross_references.csv`
(gitignored per existing convention — only the script is committed). A small residual gap remains
(~27 of 24,115 OT slots and the very last NT verse, Revelation 22:21, weren't consumed) —
deliberately left as-is rather than chased further; likely just a couple of genuinely-empty tail
entries, not a repeat of the structural bug above.

**Schema, types, and the reading-view UI for TSK cross-references are now built.**
`supabase/migrations/0009_tsk_cross_references.sql` adds `tsk_cross_references` (same read-only,
open-RLS pattern as `strongs_lexicon`/`word_tags`). `useCrossReferences.ts` fetches chapter-scoped
and groups by `from_verse_id`, same shape as `useJournalExcerpts`. Discoverability was a genuine
open question — TSK cross-references exist for nearly every verse, but the docked side panel
previously only opened via an existing note/reflection/journal icon, which would've made almost
all of this new data unreachable. Resolved by adding a **"Refs" action to the existing
tap-verse-number floating bar** (`SelectionActionBar.tsx`) alongside Note/Reflect/Copy/+Add —
opens the docked panel for that verse, works on any verse, no new gesture. The panel's new
"Cross-references" section (`VersePanel.tsx`) renders each target as a link
(`formatReferenceRange()` in `books.ts`, new) back into the reading view. Verified live via the
TEMP-VERIFY mock-data technique, then re-verified against the live database once Aaron applied
migration 0009 and imported the full CSV — **TSK cross-references are fully live end-to-end.**

Also fixed the same day: following a cross-reference link dropped you at the top of the target
chapter (no indication of which verse) and left the docked panel showing stale data for the verse
you navigated *from*. Cross-reference links now carry a `verse` query param; `ReadingView` opens
the panel for the verse you land on and scrolls/highlights it (`.verse-target` CSS).

**Scripture full-text search is live** (`/search`, `src/features/search/`) — search any word or
phrase across the whole Bible, not just your own writing (which the Journal search box already
covered). Migration `0010_verse_search.sql` adds a generated `tsvector` column
(`verses.search_vector`, auto-maintained from `text`, no trigger needed) plus a GIN index;
`useScriptureSearch.ts` is a plain `supabase-js` `.textSearch()` call — no RPC needed, unlike the
concordance's `verses_for_strongs()`. Results link into the reading view via
`/?book=&chapter=&verse=`, reusing the scroll-to-verse behavior above. Debounced search-as-you-type
(300ms), capped at 200 results. Migration applied by Aaron same day; verified against real data
(searching "shepherd" correctly returns every occurrence in canonical order, Genesis 46:32 through
1 Peter 5:4, stemmed matches like "shepherds"/"shepherd's" included) — **fully live.**

**Exact-phrase search added same day**, at Aaron's request. First attempt used
`type: 'websearch'` (→ Postgres's `websearch_to_tsquery`), which does handle `"quoted text"` as a
phrase in general — verified with `"green pastures"` narrowing correctly to Psalm 23:2. But Aaron
caught a real failure: `"was the word"` returned generic "word"-containing verses instead of the
literal phrase (missed John 1:1 entirely, the most obvious hit). Root cause: Postgres's `english`
text-search config treats extremely common words — "was", "the", "is", "a" — as **stopwords** and
strips them from both the indexed text and the query. A quoted phrase built mostly out of
stopwords degrades to almost nothing, silently losing the phrase requirement. Since Bible text is
full of exactly these words ("the LORD", "I am", "was the Word"), this wasn't an edge case.

**Fixed** by giving quoted phrases their own path in `useScriptureSearch.ts`: when the whole query
is a single `"quoted phrase"`, it now runs as a literal case-insensitive substring match (`ilike`)
against `verses.text` instead of going through `search_vector` at all — genuinely exact, immune to
stemming/stopword stripping. Unquoted queries still use `websearch_to_tsquery` for stemmed
recall. Verified live: `"was the word"` now returns exactly the 5 verses containing that literal
phrase, John 1:1 included; unquoted `shepherd` still stemmed-matches as before.

**Results grouped by exactness, same day**, per Aaron's follow-up ask — a quoted search should
surface exact matches as their own group up top, not interleaved with looser matches. A quoted
query now runs *two* queries: the `ilike` exact match (above) plus a `websearch_to_tsquery` on the
same words with the phrase requirement dropped, for verses that mention the same words but not as
that literal phrase — deduped against the exact set. `ScriptureSearch.tsx` renders these as two
sections, "Exact matches" then "Related matches" (with a hint that it's not the exact phrase);
plain unquoted queries keep the original flat single-list UI, unchanged. Verified live:
`"in the beginning"` shows 19 exact matches (Genesis 1:1, John 1:1, every literal "in the
beginning of..." included) followed by 115 related, non-overlapping matches.

**Fixed same day: the deployed site 404'd on any direct load or hard refresh of a route other than
`/`** (e.g. `/search`, `/journal`) — Vercel had no rewrite rule telling it to fall back to
`index.html` for client-side routes, so a fresh request for `/search` hit the server directly and
found no matching static file. Added `vercel.json` with a catch-all rewrite to `index.html`. This
was very likely the real cause behind an earlier "hard refresh on /search shows no change" report.

**Commentaries started** (spec §102, Phase 2+) — Matthew Henry's Concise Commentary (MHCC) is the
first of three planned public-domain commentaries, picked as the starting point since its
per-verse structure let the extraction reuse the TSK zCom-decoding approach. New
`commentary_entries` table (migration `0011_commentary_entries.sql`, generalized via a `source`
column so JFB/MHC can reuse it later without a new migration), `useCommentary.ts`, and a
"Commentary" section in `VersePanel.tsx` alongside Cross-references. See "Seeding commentary data"
above for the real desync bug found and fixed while building the extraction script — worth reading
if resuming commentary work, since the same empty-slot-padding issue could recur in JFB/MHC's own
zCom data. Migration applied and CSV imported by Aaron same day; confirmed via REST and live in
the browser — Psalm 23:1 shows its real Matthew Henry commentary (correctly starting "Chapter 23
Confidence in God's grace and care...") alongside its cross-references. **Fully live.**

**Follow-up polish, same day, at Aaron's request**: two real gaps in the extracted text and one UI
gap. (1) "Genesis Genesis is a name taken from..." — the book-title OSIS tag's own text ("Genesis")
was landing directly in front of the book's intro paragraph, which happens to *also* start with
the book's name; (2) chapter-intro/outline text (a book's intro paragraph, a "Chapter Outline"
summary) was running straight into the actual verse commentary with no visual separation at all,
since the original extraction just concatenated everything into one string. Fixed in
`clean_text()` (`scripts/transform_mhcc.py`): book-title and chapter-number OSIS tags are now
dropped entirely (redundant — the panel already shows the reference), the outline `<table>` is
reformatted into a small bulleted list instead of discarded, and each of these pieces becomes its
own paragraph (joined with `\n\n`) instead of one run-on blob. (3) `VersePanel.tsx` gained a
`CommentaryItem` sub-component — collapsed by default to the entry's first paragraph, "Show more
▾" expands the rest, same expand/collapse pattern `AnchorScripture.tsx` already established.
Verified live via TEMP-VERIFY mock, then re-verified against real data after Aaron truncated and
re-imported `commentary_entries` — Genesis 1:1 correctly shows three separate paragraphs (intro,
Chapter Outline as a clean bulleted line, then the actual verse commentary), no duplication,
expand/collapse both confirmed. **Fully live.**

**Investigated and could not reproduce**: the previously-open "cannot highlight after committing a
+Add note/reflection" bug. Stubbed `addNote`/`addReflection` to skip the real Supabase write (same
TEMP-VERIFY pattern used throughout this project) and drove the exact reported sequence — select →
+Add → select more → Note/Reflect → Save → fresh highlight attempt — via both the Note and Reflect
paths. Both times the app was left in a clean, fully-functional state; the highlight click reached
the real `createHighlight` call, only blocked by lack of dev-session auth. Likely already fixed as
a side effect of later work; would need a fresh, more specific repro (exact gesture/device) to
investigate further.

**Nave's Topical Bible added** (spec §4.3, moved up ahead of calendar/reading plans at Aaron's
request, alongside the remaining commentaries — see "Seeding Nave's Topical Bible" above for the
zLD binary format details and the 8-byte-vs-12-byte block-index surprise). New `/topics` page
(`src/features/topics/`) — search topic names via a new `search_nave_topics()` RPC (migration
0012), select one to see its verse references grouped by label, each linking into the reading view
via the existing scroll-to-verse behavior. New `nave_topics` table, `useNaveTopics.ts` hook.
Migration applied and CSV imported by Aaron same day; confirmed via REST (77,922 rows) and live in
the browser with real data — searching "faith" returns FAITH/FAITHFULNESS/FIGHT OF FAITH/
UNFAITHFULNESS, and FAITH's detail view shows all 766 of its real verse references correctly
grouped by label with working links. **Fully live.**

**JFB commentary added** (second of three, see "Seeding commentary data" above for the zCom4
binary-format surprise). `VersePanel.tsx`'s `COMMENTARY_SOURCE_LABEL` map extended with JFB —
`commentary_entries` already supported multiple sources with zero schema changes, by design.
Verified live via TEMP-VERIFY mock, then re-verified against real data — Aaron's first import
duplicated rows for Genesis through Ruth (partial re-upload, ~2,992 extra rows: 19,874 live vs.
16,882 in the CSV), caught via a `source=eq.JFB` REST count check plus spot-checks across the
canon showing 2 rows at several early-OT verses but 1 everywhere from Psalms onward. Fixed with
`delete from commentary_entries where source = 'JFB';` + a clean single re-import — re-verified
at exactly 16,882 rows with zero duplicates at every spot-checked verse (Genesis through
Revelation), and confirmed in-browser that Psalm 23:1 shows both MHCC and JFB exactly once each.
**Fully live.**

**Barnes' Notes added** (third and final of the three planned commentaries, NT-only — see "Seeding
Barnes' Notes" above for the `BlockType=CHAPTER`/`ThML` structural surprises and the
content-label-based verse-range parsing this required, a real departure from MHCC/JFB's
cursor-walk approach). `VersePanel.tsx`'s `COMMENTARY_SOURCE_LABEL` map extended with BARNES —
same `commentary_entries` table, zero schema changes. Verified live via TEMP-VERIFY mock (Matthew
1:17) first — renders correctly alongside TSK cross-references, expand/collapse works — then
re-verified against real data after Aaron imported `data/barnes_commentary.csv`: `source=eq.BARNES`
REST count is exactly 7,271 (matching the CSV precisely, no partial-import repeat of the JFB
incident), and spot-checks across Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians,
Galatians, Ephesians, Hebrews, James, 1 Peter, 1 John, and Revelation all confirm correct content.
Several chapters (Mark 1, 1 Corinthians 13, Hebrews 11, James 1) show no entry covering verse 1 —
confirmed this matches the local CSV exactly, i.e. Barnes' own choice not to comment on those
opening verses individually, not an import gap. **Fully live.**

Still ahead: calendar, reading plans, "Today, I..." templates. All three planned commentaries
(Matthew Henry, JFB, Barnes) now built.

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
