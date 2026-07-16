# Spec Amendment v1.2 — Prayer System, Scriptural Grounding & the Social Horizon

**July 15, 2026 · Amends: Bible Study App Spec v1.0 (and v1.1)**
**Status: Designed. Prayer core targets Phase 2; grounding targets Phase 3; social targets Phase 4.**

---

## B1. What this amendment adds

A prayer-tracking system — user-defined lists of prayer requests, each carrying its own history of prayed-marks, progress, reflections, words, and concerns — plus AI-assisted scriptural grounding per request, and the foundations of the social layer: shared prayer, group studies, and encouragement.

**Architectural significance:** the prayer request is the app's first *long-lived* object. Notes, entries, and sessions are moments; a request is a container with a lifecycle (opened → accumulating history → answered/archived). Its detail page becomes the **fifth lens** over the unified store: "everything connected to this request."

---

## B2. Data model

**`prayer_lists`** — user-defined groupings.
- `id`, `user_id`, `name`, `sort_order`, `created_at`

**`prayer_requests`**
- `id`, `user_id`, `list_id`, `created_at`
- `title`, `description`
- `status`: `active` | `ongoing` | `answered` | `archived`
- `answered_at` (nullable), `answered_note` (nullable — the testimony)
- `visibility`: `private` (default) | `shared` | `group` | `public` (see B7; Phase 2 ships private-only, column exists from day one)
- `grounding` (JSONB, nullable — cached scripture grounding, see B5)
- `grounding_generated_at` (nullable)

**`prayed_marks`** — the one-tap "I prayed for this."
- `id`, `request_id`, `user_id` (the person who prayed — owner in Phase 2; may be a friend once sharing exists), `created_at`
- `session_id` (nullable — links prayer to the reading session it happened within)
- Deliberately writing-free. Marks are *gestures, not thoughts* (same doctrine as highlights, v1.1). Zero friction or the tracker dies by February.

**Change to `entries`** (§4.2): add nullable `request_id`. New entry types: `prayer_update` | `word` | `concern` (extensible).
- Progress notes, reflections, sensed words from the Holy Spirit, visualizations, and fears are all *writing* — they live in the existing unified store, attached to the request.
- Entries attached to a request retain full citizenship in the web: inline `@verse` tags flow to `verse_references`, so a prayer reflection tagging `@1 Cor 6:19` appears in (1) the request timeline, (2) the journal timeline, and (3) that verse's side panel in the reading view.

---

## B3. Surfaces

**Prayer home:** lists with request cards (title, status chip, "last prayed" whisper, unread-encouragement dot post-social). A quiet daily view — "requests you haven't touched lately" — surfaced gently, never as guilt (Principle 3 applies to prayer doubly).

**Request detail (the fifth lens):** the request's story in one place —
- Header: title, description, list, status, controls (mark prayed · add update · change status · grounding · sharing when available)
- **Prayed timeline:** marks rendered as a quiet visual rhythm (dots/strip), not a ledger of numbers
- **History:** all attached entries interleaved chronologically — updates, words, concerns, encouragements — rendered with the same typographic care as journal entries
- **Grounding panel:** see B5
- Marking `answered` prompts (never requires) an `answered_note` — the testimony

**The answered ledger:** a dedicated view of answered requests across all lists, each opening to its full history — fears, words, progress, resolution. A memorial built as a byproduct of tracking. This view is a Phase 2 freebie (it is a status filter) with outsized spiritual value.

**Cross-surface integration (all automatic):**
- Calendar: prayed-marks join the day texture (fold into existing dot language; recommend the purple "wrote/marked" dot rather than a fourth color)
- Reading log: session expansion shows "prayed for 2 requests"
- Reading view side panel: entries attached to requests appear like any writing; their card notes the request ("from *Weight & stewardship*")

---

## B4. Prayed-mark mechanics

- One tap from the request card or detail. Timestamp only; time display optional per user preference.
- Optional session link when marked during an open reading session.
- A "prayed through my list" flow: step through a list's requests one at a time, marking as you go — a designed prayer session, not a checklist grind. Exit anytime; no completion framing.

---

## B5. Scriptural grounding

Two layers; the expensive one is generated once and cached forever.

**Layer 1 — Reference lookup (zero tokens, offline):** Nave's Topical Bible (public domain, already in the v1.0 reference stack) maps topics → verse lists. Requests carry optional topic tags; matching topics surface curated verse sets instantly.

**Layer 2 — AI-curated grounding (generated once per request, cached):**
- A single Haiku-class call reads the request title/description and returns structured JSON: a grounding set of **four facets**, each holding several verse references + a one-line "why this speaks to your request":
  1. **What Scripture says about the desire itself**
  2. **Stewardship & posture** (e.g., body as temple for a health request)
  3. **Encouragement** — verses that cheer the user toward the goal
  4. **Gentle reframe** — verses that may lovingly enlarge or redirect the desire (a faithful companion does not only cheerlead)
- Stored in `prayer_requests.grounding` (JSONB of verse IDs + facet + note — references resolve against bundled translations, so rendering is local and translation-switchable).
- **Refresh on demand** ("re-ground this request") when the request evolves; regenerating overwrites the cache.
- Every referenced verse is a live link into the reading view; grounding verses may be prayed *from*.

**Cost:** ~1 call ≈ a penny or less per request, once — not per view. 1,000 users creating requests freely ≈ coffee money. The user's topic-level cache idea (reuse grounding across similar request kinds) is a valid later optimization but likely unnecessary at these economics; per-request generation is also more personal.

**Consent & transparency:** the first grounding request per user shows a one-time plain-language notice: the request's text is sent to the AI service to generate the verse set; nothing else is sent; nothing is stored outside the app. Grounding is opt-in per request (a button, not automatic). Grounding gates with the premium tier alongside the study assistant (§6).

**Posture rule (inherits Principle 4):** grounding surfaces scripture; it never promises outcomes, never plays prophet, never tells the user what God will do. The facet notes describe what the text says, not what the future holds.

---

## B6. Privacy covenant (heightened)

Prayer requests are the most intimate data the app will ever hold — more than journals. All v1.0 §9 protections apply doubly:
- Admin can see that requests exist (counts, aggregate usage), never content. RLS/encryption as per the v1.0 open item.
- Grounding calls send request text to the AI API transparently (B5 consent) and results are stored only on the user's row.
- Once sharing exists: **shared content is visible to those it was shared with — and to no one else, including admin — except when a recipient reports it for moderation review** (B7).

---

## B7. Sharing & the social horizon (Phase 4)

Multi-user architecture (a day-one decision) makes social a visibility problem, not a rebuild.

**B7.1 Prayer sharing**
- `visibility` on each request: `private` (default; nothing is ever born shared) → `shared` (named friends) → `group` (a group the user belongs to) → `public` (user's whole community). Changeable anytime; tightening visibility takes effect immediately.
- Enforced by row-level security, not application code — the database itself refuses to serve rows to the wrong eyes.
- **"Praying for you":** a friend taps the prayed-mark on a shared request → the owner is notified someone prayed (with the friend's name). The mark is a `prayed_marks` row where `user_id` ≠ owner. Quiet, non-performative, deeply meaningful.
- **Encouragement:** friends attach entries (`entry_type: encouragement`) to shared requests — words of support, cheer, scripture via inline `@verse` tags. One new concept (content on your object authored by another), all machinery reused.
- Request owner controls: close to new encouragement, hide a specific person's, unshare entirely.

**B7.2 Friends & groups**
- `friendships` (mutual consent), `groups`, `group_members` (roles: leader/member).
- **Group study boards:** posts are entries with a `group_id`, anchored to passages via the existing verse-reference system. A group post on PHP.2.5 can appear in members' reading-view side panels in a distinct "group" section beneath their own content — the study happens *inside the text*.
- **Group reading plans:** shared enrollment in a plan; progress visible gently ("5 of 8 have read this portion") — presence, never a leaderboard. Individual pace remains progress-based per v1.0; nobody is "behind."

**B7.3 Messaging — out of scope by design (decided July 15, 2026)**
Direct messaging will not be built. This is a product-identity decision, not a deferral:

1. **Every social feature in this app is anchored.** Encouragement lives on a prayer request; board posts live on a passage; prayed-marks live on a request. All connection flows *through* scripture and prayer — the things the app exists for. DMs would be the sole unanchored channel, and unanchored channels inevitably absorb the platform's moderation energy while diluting its purpose.
2. **Users already have messaging apps.** They do not have a place where a friend can tap "I prayed for this today." The app competes on the second, not the first.
3. **Burden asymmetry.** DMs carry the full weight of a communications platform — abuse handling, blocking regimes, safety obligations — for marginal connective value over the anchored features.

If this is ever revisited, the burden of proof sits with the proposal: it must demonstrate a form of ministry the anchored features cannot serve, and account for the moderation cost. The schema does not reserve structures for messaging.

**B7.4 Moderation minimum (required the day anything is shareable)**
- Report action on any shared content → flags it for admin review (this is the sole, narrow exception to the content wall, limited to the reported item, visible to the reporter and admin).
- Block user (severs visibility both directions), leave group, unfriend.
- Group leaders can remove posts/members within their group.

---

## B8. Phasing (amended)

| Item | Phase |
|---|---|
| Prayer lists, requests, prayed-marks, request detail, answered ledger | **Phase 2** (daily-driver value for the primary user now) |
| Entries↔request integration, calendar/log/panel cross-surfacing | **Phase 2** (rides on existing systems) |
| Layer-1 grounding (Nave's topical) | **Phase 2/3** (with Nave's import) |
| Layer-2 AI grounding (four facets, cached, consented) | **Phase 3** (premium tier, alongside study assistant) |
| Sharing, friends, groups, boards, group plans, moderation minimum | **Phase 4** (new phase: Community) |
| Messaging | **Out of scope by design** (B7.3) |

Schema hooks (visibility column, `request_id` on entries, user-attributed marks) ship with Phase 2 so no later migration is disruptive.

---

## B9. Cost impact

- Prayer core: zero new services; rows in Supabase.
- AI grounding: ~½–1¢ per request created (once, cached); premium-gated; negligible at any realistic scale.
- Social: Supabase realtime (already in stack) covers notifications/boards at small scale within existing tier pricing; revisit at hundreds of daily-active community users.
