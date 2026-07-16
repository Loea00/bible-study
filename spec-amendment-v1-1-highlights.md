# Spec Amendment v1.1 — Highlights & Span Anchoring

**July 15, 2026 · Amends: Bible Study App Spec v1.0**
**Status: Designed post-build-start. Supersedes the whole-verse highlight implementation of July 14.**

---

## A1. What this amendment adds

Highlighting was built as a feature (multi-color, whole-verse) before it was designed. This amendment specifies the full design: sub-verse precision, multi-verse and non-consecutive highlights, translation-specific anchoring, overlapping marks, and — the structural insight — a **unified span-anchoring system** shared by highlights and all writing types, rather than a private system for highlights alone.

---

## A2. Unified span anchoring (schema change to v1.0)

The span — `(verse_id, start_offset, end_offset, translation)` — is an *anchoring* concept, not a highlight concept. Anything that points at scripture may point at a span.

**Change to `verse_references`** (§4.2): add three nullable columns:

- `start_offset` (int, nullable) — character offset within the verse text
- `end_offset` (int, nullable)
- `translation` (text, nullable) — the translation the offsets were measured in (e.g., `KJV`)

**Semantics:**
- All three null → the reference means the **whole verse**. This is today's behavior; nothing existing changes.
- All three present → a precise, translation-specific span within the verse.

This gives margin notes, reflections, and journal tags sub-verse precision for free, using the same columns and the same rendering code as highlights. A note may be anchored to "Be still, and know" rather than all of PSA.46.10.

---

## A3. Highlights — data model

Highlights are **not writing**, so they do not live in `entries`. New tables:

**`highlights`**
- `id`, `user_id`, `created_at`
- `color` (from the app palette; muted tones)
- `translation` (the translation the highlight was made in)
- `spans` (JSONB: ordered array of `{verse_id, start_offset, end_offset}`)

A single highlight row **is** the group. Its spans array expresses every shape:

| User intent | Spans |
|---|---|
| Part of one verse | one span |
| Whole verse(s) | one span per verse, offsets covering full text (or null-offset spans) |
| Across a verse boundary | two spans meeting at the seam |
| Non-consecutive parts ("refuge" + "in trouble") | multiple disjoint spans, one row |

If span-level querying becomes needed (e.g., "all highlights touching PSA.46"), either query the JSONB or promote spans to a `highlight_spans` child table — a mechanical migration. Start with JSONB; it is simpler and sufficient at Phase 1–2 scale.

**Deletion always operates on the highlight row (the group), never on individual spans.**

---

## A4. Translation specificity & fallback

Character offsets are only meaningful in the translation they were measured in ("a very present help" occupies different positions — and possibly different words — in KJV vs. WEB).

**Rules:**
1. Every sub-verse span records its home `translation`.
2. Viewing the same passage in the **home translation**: render the span exactly.
3. Viewing in **any other translation**: degrade gracefully — treat the reference as whole-verse (render highlight as a faint whole-verse wash; note anchors summon a whole-verse glow). The connection survives; only the precision is translation-bound.
4. Whole-verse references (null offsets) are translation-independent and render identically everywhere.

---

## A5. Overlapping marks

**Data:** nothing to solve. Every highlight and every note anchor is independent; any character may fall inside any number of them. "Refuge" may simultaneously sit in a yellow phrase-highlight, a blue word-highlight, and a margin note's anchor — three rows, no conflict.

**Rendering (decided):**
- Highlights render as **translucent tints** (~20–25% opacity). Overlaps compound naturally by stacking: same color deepens, different colors blend softly. No special-case blend logic.
- **Cap visual stacking at two layers** — a third+ overlapping highlight adds no further darkening.
- **Note anchors are invisible in running text, always.** The verse-side icon is the only ambient signal. Anchor spans reveal in exactly two moments: (a) tapping the note in the side panel gently glows its words in the text; (b) study mode shows anchored spans with the same dotted-underline register as the Strong's layer.

**Interaction (decided):**
- Tap on text carrying **one** mark → open it directly.
- Tap on text carrying **multiple** marks → small popover listing each: color swatch or note icon, first words / note opening, date; most recent first. One more tap opens or removes.
- **Removal happens only via this popover and always removes the whole group.** No direct-tap deletion.

---

## A6. Side panel & cross-reference web

- Highlights **join the web as lighter citizens**. The verse side panel shows one quiet line — "2 highlights" with color dots — expandable on tap. They never visually compete with notes, journal excerpts, or reflections.
- Each highlight in the expanded view carries one affordance: **"Add note"** — creates a `margin_note` entry anchored to the identical span (via §A2 columns). Marking and writing form a continuum.
- Highlights are timestamped and session-linked like everything else, so they appear in reading-log session expansions ("2 highlights made") and on the calendar's "wrote/marked" texture. *(Optional: fold into the purple dot rather than adding a new dot color — recommend folding; the three-dot language stays clean.)*

---

## A7. Migration of the July 14 implementation

Existing highlights are whole-verse, colored, single-verse rows.

1. Create `highlights` per §A3.
2. Convert each existing highlight to one row: `spans = [{verse_id, start_offset: null, end_offset: null}]`, `translation: null` (whole-verse semantics per §A2/§A4), preserving color and timestamps.
3. Point the existing add/remove UI at the new table; removal already being built maps to group deletion.
4. Sub-verse *selection* UI (drag/adjust handles within a verse) may ship after the schema lands — the model supports it before the UI does.

---

## A8. Amended cost of change

No new services, no new costs. One schema migration, one new table, rendering work in the reading view. Phase placement: span schema + migration now (it is cheaper before more data accumulates); polished overlap rendering and sub-verse selection handles may trail by days or weeks without harm.

---

## A9. Selection model (how spans get made)

Selection uses **native browser text selection** plus a custom capture layer. Do not build a bespoke selection engine.

**Gesture map (reading view):**

| Gesture | Meaning |
|---|---|
| Tap a word | Strong's lexicon card (unchanged from v1.0) |
| Long-press a word (touch) / click-drag (mouse) | Begin native text selection; drag handles extend across words and verse boundaries |
| Release a selection | App action bar appears near selection: Highlight · Note · Reflect · Copy · Ask |
| Tap a verse number | Select the whole verse in one gesture (fast path; no dragging) |
| "+ Add" in the action bar | Multi-select mode: current span(s) held in a provisional tint; next selection appends to the group; committing Highlight/Note writes one group row |

**Capture layer requirements:**
1. Listen for selection end (mouseup / touch selection change); suppress the default context menu within the scripture pane.
2. Map the DOM selection to spans: for each verse element touched, emit `(verse_id, start_offset, end_offset)`. A selection crossing verse boundaries yields one span per verse (per §A3).
3. **Compute offsets against the canonical verse text from the database, never against rendered DOM text** — rendered markup (word-level Strong's spans, verse numbers, icons) must be excluded from offset math. Stored offsets must survive any future re-render of the reading view.
4. Record the active translation on every sub-verse span (per §A4).

**Notes:**
- Word-tap (lexicon) vs. long-press (selection) is the tap-disambiguation standard from mainstream reading apps; follow it.
- Non-consecutive selection has no native gesture anywhere; the "+ Add" pending-group interaction is the designed solution and an intentional differentiator.
- Verse-number tap covers the dominant use case (whole-verse marking) with zero drag effort; optimize its ergonomics first, selection handles second.
