# Spec Amendment v1.4 — Theming System (Skins)

**July 15, 2026 · Amends: Bible Study App Spec v1.0 (and v1.1–v1.3)**
**Status: Designed. Targets Phase 1 (token architecture) / Phase 2 (theme picker UI).**

---

## D1. What this amendment adds

A **theme system**, not a fixed set of looks. Four themes are designed now (Warm Paper, Vellum & Slate, Before Dawn, and a bold youthful blue direction — name TBD), each shipping in both light and dark variants — but the underlying architecture is an open-ended token contract, so new themes ("skins") are additive data, not new code.

**Architectural significance:** this is a Phase-1-must-decide-now item, like the verse ID or the unified entry store. If components are built reaching for hardcoded color values, retrofitting theming later means touching every screen. If components are built reaching for **named tokens**, a theme is just a JSON object assigning values to those names.

---

## D2. The token contract

Every visual surface in the app is built exclusively against a fixed set of token names — never a raw hex value in component code. Representative tokens (exact set to be finalized during build, but the categories are fixed):

- `--surface-page`, `--surface-card` — background layers
- `--text-ink`, `--text-muted` — primary and secondary text
- `--text-christ` — the red-letter (or theme-equivalent) color for words attributed to Jesus
- `--accent` — the single signature accent color (thread lines, active states, primary actions)
- `--border`, `--border-strong` — hairlines
- `--font-voice` (serif, for scripture and user writing), `--font-sans` (interface), `--font-data` (verse IDs, Strong's numbers)

A **theme** = one JSON object populating every token, for both `light` and `dark` mode (8 values × 2 modes, roughly). Applying a theme is swapping the token set at the root of the app — every component updates simultaneously, because every component was already reading from tokens rather than deciding colors itself.

**This is the same discipline the mockups in this conversation have followed** — each design direction was built by naming a background, an ink, an accent, and a red-letter color, then deriving everything else. The app's real components should follow the identical pattern.

---

## D3. Data model

**`themes`** — built-in and (future) user-created token sets.
- `id`, `name`, `author` (`system` for built-ins), `is_public` (for future user-shared skins)
- `tokens` (JSONB: the full token set, light + dark variants)

**Change to `users`** (§4.2, preferences): add `theme_id` (no silent default — see D4.2), `color_mode`: `light` | `dark` | `auto` (auto follows system/time-of-day), and `red_letter_color` (default: traditional red — see D4.1, decoupled from theme choice).

No change to any other table — theming is purely a rendering-layer concern layered on top of existing data.

---

## D4. Launch themes (Phase 1)

Four are designed; naming and final tuning to continue as the app is used daily.

| Theme | Character | Red-letter treatment |
|---|---|---|
| **Warm Paper** | Aged paper, near-black ink, indigo accent — devotional, timeless | Muted brick red |
| **Vellum & Slate** | Cooler, monastic, restrained — text-forward, least ornamented | Muted brick red |
| **Before Dawn** | Pre-dawn blue-gray with a single coral-gold accent — the boldest, most personal direction, doubles naturally into night mode | Warm coral |
| **The Blue Period** | Saturated royal blue, brighter surfaces, heavier sans weights, rounder corners — energetic and app-like rather than devotional-quiet | **User-defined preference** (see D4.1) — not fixed by the theme |

All four ship with light and dark variants at launch. **Every theme keeps the serif-for-scripture / sans-for-interface split from Principle 2** — The Blue Period changes color and weight, not the fundamental voice-separation the app is built on.

### D4.1 Red-letter color is a decoupled preference

Rather than fixing the words-of-Christ color per theme, it becomes its own preference: `red_letter_color` on `users` (or theme-scoped if a user wants it to vary by theme), independent of which theme is active.

- **Default:** traditional red, honoring the 125-year red-letter convention most users recognize.
- **Options:** traditional red, or the theme's accent-harmonized alternative (e.g., cyan under The Blue Period, coral under Before Dawn) — and in principle any color the token system supports.
- This decouples a font-level aesthetic choice (which theme) from a textual/devotional one (how Christ's words are distinguished) — a user may want The Blue Period's energy while keeping red-letter traditional, or vice versa. Neither theme forces the other's hand.

### D4.2 No theme is default without a choice

**The app ships with no silent default beyond the safest, most broadly comfortable option** (recommend Warm Paper) **until the user actively chooses otherwise.** The Blue Period in particular — being the boldest departure from the app's devotional register — is opt-in only: a user arrives at Warm Paper (or whichever theme is designated the out-of-box choice) and discovers the others in Settings → Appearance, rather than being surprised by a bold theme on first launch. This matters most for a future public release, where first impressions vary widely across a user base Aaron doesn't personally know.

---

## D5. Surfaces

**Settings → Appearance:**
- Theme picker: visual swatches (small live preview per theme, not just a color chip) — pick one of the shipped themes.
- Color mode: Light / Dark / Auto (auto suggestion: follow system setting, or optionally time-of-day for a "night mode kicks in at your usual evening reading time" feel — nice-to-have, not required).
- (Phase 3+, if pursued) "Create a skin" — expose the same token form used internally, so a user can define their own set. Gated behind `is_public` before anything is shared with others.

**No other surface changes.** Every screen already spec'd (reading view, journal, prayer, calendar, etc.) inherits whichever theme is active without any per-screen theming work, provided §D2's discipline is followed.

---

## D6. Phasing

| Item | Phase |
|---|---|
| Token contract + all four themes wired into every component | **Phase 1** (must be foundational — retrofitting is expensive) |
| Light/dark variants for all themes | **Phase 1** |
| Settings → Appearance picker UI | **Phase 1/2** |
| Auto (system or time-of-day) mode | **Phase 2** |
| User-created skins, sharing | **Phase 3+, optional** — architecture already supports it via `themes.is_public`; no schema change needed to add later |

---

## D7. Cost impact

None. No new services. The only cost is discipline during Phase 1 build: components must be written against tokens from the first line of CSS, not retrofitted. This is the cheapest possible moment to require it.
