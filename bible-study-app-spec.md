# Bible Study App — Product & Technical Specification

**Working draft v1.0 · July 14, 2026**
**Owner: Aaron · Co-designed with Claude**

---

## 1. Vision

A Bible reading and study app where scripture, personal writing, and reference scholarship live in one connected system. The user reads, writes, and reflects; the app quietly weaves everything into a single web of connections, so that every verse carries the user's whole history with it — margin notes, journal entries, reflections, lookups, and two centuries of public domain scholarship — one glance away, without any manual filing.

**The core insight:** notes, journal entries, reflections, and logs are not separate features. They are different doorways into one room — a single database of the user's spiritual life, indexed by scripture, by time, and by narrative.

**Primary user (Phase 1):** Aaron. Built as a daily driver first.
**Product horizon:** Community and public release once the personal experience is proven. Architecture is multi-user from day one so productizing is a matter of opening the doors, not rebuilding.

---

## 2. Guiding principles

1. **Cross-referencing is a byproduct, never a chore.** Connections form as a side effect of natural reading and writing (inline @verse tags, automatic session capture). If a feature requires manual data entry to stay useful, redesign it.
2. **Reading comes first.** The scripture page stays visually quiet. Study tooling (word links, icons, panels) is available everywhere but shouts nowhere. Serif for scripture and the user's own writing; sans-serif for interface.
3. **Gentle, never gamified guilt.** Streaks are shown, never enforced. Plans attach to progress, not dates — a missed week re-flows silently; the user is never "behind." No shame notifications, ever.
4. **The AI is a study assistant, not an authority.** It surfaces language, history, cross-references, and the user's own past thinking. Interpretation and hearing from God remain the user's.
5. **Privacy as covenant.** The app holds people's prayers and inner life. User content is off-limits to admin eyes. Aggregate metrics only.
6. **The user's writing is reading material.** Journals and reflections render beautifully, in the same typographic register as scripture.

---

## 3. Architecture overview — one database, many lenses

All user-created content lives in a unified store. Each surface of the app is a *lens* over that store:

| Surface | Lens | Query shape |
|---|---|---|
| Reading view side panel | Scripture lens | "Everything linked to this verse/passage" |
| Journal timeline | Narrative lens | "Entries ordered by time, filterable by type" |
| Reading log | Session lens | "What was read, and what was created during it" |
| Calendar | Time lens | "Everything dated to this day, plus planned items ahead" |

The calendar stores almost nothing of its own — past days are queries over existing timestamped records; only future plan schedules are new data.

**Stack recommendation:**
- **Backend:** Supabase (Postgres, built-in auth, row-level security, realtime sync). Multi-user from day one.
- **Frontend:** React (web first; React Native or Capacitor for mobile later). Component-driven so surfaces share the entry-rendering system.
- **AI:** Anthropic API (Haiku 4.5 default, Sonnet-class for harder questions), called server-side with per-user metering.

---

## 4. Data model

### 4.1 The verse ID — universal join key

Every verse has a stable canonical ID (`PSA.46.10` style, OSIS or similar convention). Ranges are stored as start/end pairs (`PSA.46.1`–`PSA.46.3`). All linking flows through these IDs.

### 4.2 Core tables

**`users`** — Supabase auth. Profile, preferences (default translation, theme), subscription state.

**`entries`** — the unified writing record. One table for all user writing.
- `id`, `user_id`, `created_at`, `updated_at`
- `entry_type`: `margin_note` | `journal` | `reflection` | `templated_journal` (extensible)
- `title` (nullable — margin notes have none)
- `body` (rich text; inline verse tags stored as structured tokens with character positions)
- `template_id` (nullable — set for templated entries)
- `template_responses` (JSONB, nullable — ordered prompt/response pairs for templated entries)
- `anchor_start`, `anchor_end` (nullable verse IDs — set for margin notes and reflections, which *belong* to a passage)
- `tags` (topical tags array: "peace", "work", …)
- `session_id` (nullable — links to the reading session it was created during)

**`verse_references`** — the connective tissue. Any entry ↔ any verse(s).
- `id`, `entry_id`, `user_id`
- `verse_start`, `verse_end` (range support)
- `position` (character offset within entry body, for excerpt extraction)
- `ref_kind`: `anchor` (the entry belongs to this passage) | `inline` (mentioned within the writing)

**`reading_sessions`** — captured automatically.
- `id`, `user_id`, `started_at`, `ended_at`
- `passage_start`, `passage_end` (what was open)
- `last_position` (for "resume where I left off")

**`lookups`** — original-language lookups, logged per session.
- `id`, `user_id`, `session_id`, `strongs_id`, `verse_id`, `created_at`

**`reading_plans`** and **`plan_enrollments`**
- Plans: name, description, ordered portion list (each portion = a passage range).
- Enrollments: `user_id`, `plan_id`, `current_portion_index`, `enrolled_at`, `paused`.
- The daily schedule is *generated*, not stored: next unread portion appears on the next available day. Missing days re-flows the schedule forward. Leaving a plan deletes only future items, never history.

**`entry_templates`** — the "Today, I..." system.
- `id`, `name`, `description`, `version`, `published`, `author` (admin)
- `prompts` (JSONB: ordered array of `{stem, blank_hint}` — e.g., nine complete-the-sentence prompts)
- User entries reference `template_id` + store `template_responses`; templates are versioned so refining wording never corrupts old entries.

### 4.3 Reference data (read-only, shipped with app)

- **Bible texts:** KJV, WEB, ASV (public domain). Verse-per-row, keyed by verse ID.
- **Strong's mapping:** every KJV word → Strong's number (word-level tagging from open datasets: OpenScriptures, STEPBible).
- **Strong's lexicon:** number → original word, transliteration, definition, derivation.
- **Treasury of Scripture Knowledge:** ~640k verse→verse cross-references.
- **Nave's Topical Bible:** topic → verse lists (future: connect to user topical tags).
- **Commentaries (optional, Phase 2+):** Matthew Henry, Barnes, JFB — public domain, render as an optional panel section.

All reference data plugs into the same verse-ID system, so TSK cross-references and the user's own notes appear in the same side panel, in separate sections.

---

## 5. Surfaces

### 5.1 Reading view (scripture-first home)

- Clean scripture page, serif type, KJV default with translation switcher.
- **Verse indicators:** small icons beside verses that carry user content (note icon = margin notes/reflections, notebook icon = journal references). Quiet, glanceable.
- **Side panel (the payoff feature):** tapping a marked verse opens a panel showing everything connected to it, grouped by type:
  - Margin notes (full text — they're short)
  - Journal excerpts — the sentence or two surrounding the verse reference, with title + date + **"Open full entry"** click-through. Full entry opens scrolled to the referenced passage, gently highlighted.
  - Reflections (title + opening lines + click-through)
  - Reading log summary ("3 visits")
  - TSK cross-references (Phase 2)
- **Original language:** every word is tappable (whole KJV is Strong's-tagged). No underline noise by default — tap-anywhere, with an optional "study mode" toggle that reveals dotted underlines. Lexicon card shows: original word, transliteration, Strong's number, definition, derivation, and other occurrences (tap-through to full concordance list). Phrase-level mappings handled where Hebrew/Greek constructions span multiple English words.
- **Selection actions:** select a verse/passage → Note · Reflect · Copy · Ask (AI).
- Mobile: side panel becomes a bottom sheet.

### 5.2 Journal (life-first doorway)

- Timeline list: entry cards with title, date, and **verse chips** showing linked passages at a glance. Search + filter by type/tag.
- Editor: blank-page free writing in serif voice. **Inline verse tagging:** typing `@Psa 46:10` pops autocomplete; selection becomes a live tag. Tags feed `verse_references` invisibly.
- Tapping a verse tag shows an **inline verse preview** (text + translation label) without leaving the entry — plus "Open in reading view" as the bridge across doorways.
- Topical tags per entry.
- Templated entries ("Today, I...") appear in the same timeline with distinct rendering (see §8).

### 5.3 Reflection mode (scripture-first, long-form)

- Entered from the reading view: select passage → **Reflect**. Text slides aside; a writing page opens beside it.
- The passage stays pinned and readable while writing. Word-tap lexicon works mid-composition.
- Anchored to the whole passage automatically (`ref_kind: anchor`) — no tagging required. Inline `@verse` tags to *other* passages still work, connecting passages through the user's thinking.
- Appears in the verse side panel with its own icon/register, and in the journal timeline as a filterable type.

### 5.4 Reading log (session lens)

- Stat cards: current streak (shown gently, never enforced), active plan progress ("46 of 150 Psalms" — progress through scripture, not calendar compliance), notes this month.
- Past-week activity strip.
- Session list, auto-captured (passage, time span). Expanding a session shows **what was created during it**: margin notes, journal entries, reflections, and language lookups.
- **"Resume where I left off"** returns to the exact reading position.

### 5.5 Calendar (time lens)

- Month grid with a three-dot language: **green = read, purple = wrote, hollow = planned.**
- Tapping a past day lists everything dated to it (sessions + entries), each tap-through to its home surface.
- Tapping a future day shows scheduled plan portions with "Read early" and "Adjust plan."
- Empty days are neutral — "the plan simply continues from wherever you are."
- **"On this day"** (Phase 2+): resurface entries from prior years on today's date.

### 5.6 Threads (Phase 3, data already supports it)

Most-referenced verses/passages over time; a verse's panel already shows the user's evolving relationship with it across months. A dedicated view simply surfaces the pattern.

---

## 6. AI study assistant

**Posture:** study assistant, not authority. Surfaces language, history, cross-references, and the user's own past thinking. The system prompt encoding this posture is editable from the admin panel.

**Mechanics:** app calls the Anthropic API server-side. Each question ships with rich context: the passage, Strong's data for its words, TSK cross-references, and (with permission) the user's related notes/entries. This context is the differentiator no general chatbot can match — the app owns the user's study history.

**Model routing:** Haiku 4.5 by default (~½–1¢ per question at 3–5k input / 400–800 output tokens); Sonnet-class for harder questions (~2–3¢). Prompt caching on stable system content (cache reads ≈ 10% of input price).

**Cost picture (July 2026 rates: Haiku $1/$5, Sonnet 5 intro $2/$10 → $3/$15 per MTok):**
- Personal heavy use (10 q/day): ~$2/mo Haiku, ~$6–9/mo Sonnet.
- 100 users × 20 q/mo: ~$15/mo Haiku, ~$50/mo Sonnet. Scales linearly.
- **Safeguard:** per-user monthly caps / fair-use limits from day one.
- **Monetization fit:** AI features gate the premium tier ($4–5/mo); typical premium user costs 20–50¢/mo to serve.

---

## 7. Translations & licensing

- **Phase 1 (bundled, free):** KJV, WEB, ASV — public domain. KJV is primary (pairs natively with Strong's tagging).
- **Licensed translations (NIV, NLT, ESV, NASB):** deferred. Require publisher agreements, fees/royalties, display approval. Revisit post-revenue; consider API.Bible as an interim licensed-access route (mind offline-caching restrictions).
- **Architecture requirement:** translations are swappable modules keyed to verse IDs, so adding one later touches data, not code.
- All reference works bundled (Strong's, TSK, Nave's, listed commentaries) are public domain.

---

## 8. Entry templates — the "Today, I..." system

- Templates are **data, not code**: ordered prompt sets (stem + blank) stored in `entry_templates`, authored and versioned in the admin panel, published to users without app updates.
- **Launch templates:** Aaron's 9-prompt "Today, I..." daily snapshot, plus a spiritual variant (to be authored). Both are Aaron's original IP and a core product differentiator — treated with the same care as the app's name and brand.
- Templated entries live in the `entries` table (`entry_type: templated_journal`), render as a cohesive completed-sentence snapshot, support inline @verse tags inside any blank, and join the cross-reference web like all writing.
- **Data dividend:** identical structure across entries makes them queryable and reviewable ("every 'Today, I...' from March") in ways free prose isn't.
- Template system is generic — future templates (gratitude, examen, pre-Sabbath) are new rows, not new features.

---

## 9. Admin control panel (Phase 3 build; Supabase table views suffice until then)

1. **Content:** author/version/publish entry templates; create and publish reading plans; manage active translations; update reference datasets.
2. **Users:** account + subscription state, support lookups. **Hard privacy wall:** user journals, notes, and reflections are inaccessible to admin (encryption or strict RLS). Existence and billing state only.
3. **AI controls:** editable assistant system prompt, model routing, per-user caps, live cost monitoring against revenue.
4. **Metrics:** signups, actives, feature usage, plan completion — aggregate only, never content.
5. **Announcements & feature flags:** gradual rollouts, user messaging.

---

## 10. Phasing

**Phase 1 — Personal daily driver**
Reading view (KJV/WEB/ASV) · margin notes · journal with inline @tags · side panel with excerpts + click-through · reading sessions auto-capture · auth (just Aaron).

**Phase 2 — Depth**
Strong's word-tap + lexicon + occurrences · reflection mode · reading log surface · calendar · reading plans (progress-based) · TSK cross-references in panel · search across own writing · "Today, I..." template engine + first two templates.

**Phase 3 — Product-ready**
Onboarding · premium tier + AI assistant with metering · admin panel · Nave's/commentaries · threads view · "on this day" · export/sharing · evaluate licensed translations.

Phases 2 and 3 items can be re-sequenced freely; the schema supports all of them from day one.

---

## 11. Cost summary

| Item | Cost |
|---|---|
| Supabase (small scale) | $0–25/mo |
| Apple Developer (if iOS) | $99/yr |
| Google Play (if Android) | $25 one-time |
| Public domain texts & reference data | $0 |
| AI (personal use) | ~$2–9/mo |
| AI (100 users, premium-gated) | ~$15–50/mo, self-funding |
| Licensed translations | Deferred — the only four-figure item, intentionally avoided |

---

## 12. Open items

- Name and brand.
- Author the spiritual "Today, I..." variant (Aaron).
- Choose word-level Strong's dataset (evaluate OpenScriptures vs STEPBible exports).
- Web-first vs mobile-first for Phase 1 (recommendation: web/PWA first — faster iteration, no store gatekeeping; wrap for stores in Phase 3).
- Encryption approach for user content (at-rest encryption vs full E2E — E2E complicates search and AI context; decide before Phase 3).
- Excerpt length tuning for side panel (start: surrounding sentence ±1).

---

*This spec reflects design sessions of July 2026. The mockups referenced (reading view, journal, reflection mode, reading log, calendar) live in the design conversation and should be treated as directional, not pixel-final.*
