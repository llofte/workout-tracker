# Workout Tracker — Claude Code Spec

## ⚠️ SwipeBack regression — fix applied in v194, awaiting on-device confirmation

**Symptom reported by user:** on the session detail page, start a left-edge swipe-back, stop mid-drag, then touch the page again — the whole screen becomes freely draggable in any direction with the Home screen visible behind it. Same failure mode as [[reference_ios_swipe_gesture_conflict]] (iOS claims the touch as a system gesture once our `preventDefault()` stops firing).

**v193 fix attempt (WRONG root cause, didn't fix it):** guarded against a second *simultaneous* finger resetting gesture state mid-drag. User confirmed v193 did not fix the bug — the repro doesn't require simultaneous multi-touch at all.

**v194 — actual root cause:** `start()` (the `touchstart` handler) called `setAnimating(false)` **unconditionally**, on every touchstart regardless of touch position. Sequence: partial swipe released below the 33% threshold → `end()` sets `animating=true` + `setDx(0)`, starting a 220ms CSS snap-back transition. If the user's next touch — anywhere on the page, not necessarily the edge, e.g. exactly the "stop swiping, touch the page again" repro — arrives *before* that transition finishes, `start()` fired `setAnimating(false)`, which switches `transition` from the animated string to `'none'` mid-flight. A browser instantly freezes a `transition:none` element at its current *computed* (interpolated, partial) value rather than jumping to the target — so the page froze at some partial slide-open position. Since that new touch wasn't near the edge, `active` stayed `false`: no `preventDefault()`, no JS tracking — the page sat there frozen and visually offset with iOS free to claim any further movement as a system gesture.

**Fix:** `start()` now returns immediately (touches nothing — no `setAnimating`, no state reset) if the touch isn't within the left-edge zone (`clientX > 30`), in addition to the v193 guard for a second finger joining an already-active drag. A non-edge tap can no longer interrupt an in-flight snap-back animation.

**Verified (JS-state level, real iOS behavior still unconfirmed):** dispatched real `new Touch()`/`new TouchEvent()` at the actual `SwipeBack` DOM node (`el.style.willChange === 'transform'`) reproducing the exact sequence — dragged to 90px, released (transition correctly started), fired a stray touchstart at x=250 (not the edge) *during* the 220ms window, confirmed `transition` stayed at the animated string (not reset to `'none'`) and the transform still settled cleanly at `0px`. Also reconfirmed a full past-threshold swipe still completes and calls `onBack`. **Cannot verify the actual iOS symptom** (system gesture claiming, visible freely-draggable screen) from the desktop Chrome preview — needs on-device confirmation before closing this out. If v194 still doesn't fix it, the bug may be a genuine WKWebView gesture-recognizer quirk independent of our JS state (e.g. a held, stationary — never lifted — finger being reclaimed by iOS after a dwell period), which would need a different investigation approach (Safari remote debugging / on-device console, not preview simulation).

---

## Multi-Set Strength Table — column alignment RESOLVED (v192 / bb-wod-v167)

**Five separate bugs, fixed in five passes — all were real, don't reintroduce any of them:**

1. **Text not centered within its own cell (fixed in v189):** `MultiSetCell`'s root `div` had a fixed `width: 90` and relied on the parent column's `justifyContent: 'center'` to center that box in the column — but the 90px box itself didn't set `justifyContent`, so its children defaulted to `flex-start` and packed against the box's left edge. Fixed by adding `justifyContent: 'center'` to that root div.
2. **Columns themselves were unequal width (fixed in v190):** the per-column wrapper div in `renderRow` is `flex: 1`, which should divide the row equally — but a flex item's *automatic* minimum width is based on its content's min-content size, and `MultiSetCell`'s fixed `width: 90` child (present only on columns with a weight) forced that column's min-content floor above its fair share, stealing space from columns without a weight (e.g. bodyweight-only movements). Measured on the Jun 16 3-column session: columns came out **92px / 78px / 92px** instead of an even ~87px each. Fixed by adding `minWidth: 0` to that column div.
3. **Visible text still off-center after 1 & 2 (fixed in v191):** `MultiSetCell`'s reps span had a fixed `width: 20` + `textAlign: 'right'`, while the weight span was `auto`-width and flush left — invisible padding only on the left, none on the right, so glyph ink was shifted right of the box's geometric center even though the box itself measured as centered. `getBoundingClientRect()` on a fixed-width span returns the allocated box, not the actual ink extent — the two only diverge when alignment isn't flush. Verified with `document.createRange().selectNodeContents(span).getBoundingClientRect()` (true glyph bbox). Fixed (at the time) by removing the fixed reps width/textAlign entirely and letting `reps · weight` flow naturally — later reintroduced deliberately in pass 5 below, but done correctly that time.
4. **Divider lines themselves were asymmetric (fixed in v191, same release as #3):** the row used flex `gap: 4` between columns, with each divider a `borderRight` glued to the column *before* it — so the 4px gap sat only on the left side of every column's box. Content centered within that box was provably centered *within the box*, but the box wasn't symmetric between the two divider lines a person actually sees (measured a consistent 2px rightward bias on every column, every row). Fixed by replacing `gap` + `borderRight` with real sibling `ColumnDivider` elements between columns and removing `gap` entirely, so every column's box spans exactly between two divider lines with nothing hidden on either side.
5. **Dot alignment vs. true centering trade-off (added in v192):** with #1-4 fixed, per-row centering is pixel-perfect *only when every row in a column has the same weight digit-count*. A column with one outlier (e.g. four rows at "85 lbs" and one at "100 lbs") would either keep the dot fixed (old fixed-width approach, breaks #1) or truly center each row independently (breaks dot alignment across rows — the digit-count outlier's dot visibly jumps). User explicitly chose "keep the dot fixed, let the outlier's weight text spill past the slot rather than recentering" — implemented via `majorityWeightSlotWidth()`: for each movement column, count sets (warmup + working) by weight digit-count, find the mode, measure that mode's representative weight text via a cached `<canvas>` `measureText` helper, and give the weight span that exact fixed `width` + `minWidth: 0` + `flexShrink: 0` + `whiteSpace: 'nowrap'`. Majority rows fill the slot exactly (looks identical to before); the minority row's longer text overflows past the slot visually without growing the flex box (the `minWidth: 0` override is required — otherwise the browser's automatic minimum-size-from-content would grow the box to fit the overflowing text and reintroduce bug #2's mechanism). Verified against real data by temporarily adding a 5th round at 100 lbs to the Jun 16 RDL column via the Edit UI (swipe-to-delete's touch handlers had to be invoked programmatically via `props.onTouchStart/Move/End` on the row's React fiber — real touch simulation isn't available in the desktop preview) — confirmed all 6 rows' dots sit at the exact same x (112.72px) before reverting the test edit.

**Lesson for next time:** `getBoundingClientRect()` on an element with an explicit fixed width tells you the *box*, not the *visible ink* — if any child inside has asymmetric alignment, the box can measure as centered while the rendered text is not. Measure with `document.createRange().selectNodeContents(el).getBoundingClientRect()` on actual text-bearing leaf elements. Also: get user approval on a visual mock before touching real code once a fix has already gone through multiple rounds without landing — a `mcp__visualize__show_widget` mock reproducing the exact CSS technique is fast to build and avoids burning another deploy cycle on a misunderstood requirement.

**What this feature is:** strength sessions with 2+ movements done together as a superset (e.g. Snatch Pull + Power Snatch, one round = both movements at once) now render as a combined table instead of stacked separate movement blocks. Toggle in Log/Edit screen: **Single** vs **Multi** (separate from the existing Traditional/OTM toggle).

**Key files/functions:**
- `src/utils/movements.js` — `resolveStrengthMode(block)` (decides single vs multi display: explicit `block.mode`, else legacy heuristic on equal *working*-set counts across movements — warmups are independent per movement, not synced), `abbreviateForColumn(name)` (column header abbreviations, reuses `SESSION_ABBREV` for RDL/SDHP/G2OH first).
- `src/screens/SessionDetailScreen.jsx` — `MultiSetStrengthTable` (the read-only combined table; computes `weightSlotWidths` per movement column via `majorityWeightSlotWidth`), `MultiSetCell` ("x8 · 85 lbs" cell; weight span has a fixed `weightSlotWidth` prop per column, not fixed per-instance), `majorityWeightSlotWidth` + `measureTextWidth` (canvas-based digit-count-majority width detection, see bug 5 above), `ColumnDivider` (real flex-sibling divider element, not a border), `PRBadgeLabel` (icon+"PR" text, shared with single-movement `SetRows`), `computeSetPRStatus` (shared PR lookup), `MULTI_LABEL_COL_WIDTH` (currently 44, fixed-width round#/PR column).
- `src/screens/LogScreen.jsx` — `MultiSetStrengthInput` (the synced-round input UI for Multi mode), `strengthMode` state, `handleStrengthModeChange`, `addMultiRound`/`addMultiWarmupRound`/`removeMultiRound`/`addMultiMovement`/`updateMultiRoundChecked` mutators, `ImplementSelector` (now defaults BB pill active for known barbell lifts via `BB_STRENGTH_MOVEMENTS`, but not for bodyweight movements — takes a `name` prop now).

**Gotcha when measuring this table:** `document.querySelectorAll` text matches duplicate easily (e.g. "RDL" appears both in the Home screen's background movement chips AND in the detail overlay's table) — scope queries to the detail overlay container first, e.g. by finding the legend text and calling `.closest()`. Swipe-to-delete rows in the Edit UI can't be triggered by real touch events in the desktop preview — invoke `onTouchStart`/`onTouchMove`/`onTouchEnd` directly on the row's `__reactProps` instead.

**Test data (real, in production Supabase — safe to view/edit for testing):**
- **Jun 16** session: 3 movements — Romanian Deadlift (only one with a warmup, 85 lbs), Inverted Row (bodyweight, no weight), SA DB Split-Stance Press (DB, SA modifier, 20 lbs). Canonical name is "Split-Stance Press" — **there are two "Split-Stance Press" entries in the Movements list**, only the first one in DOM order is the real one linked to this session (the other is an orphaned duplicate, harmless, left alone per user's earlier decision not to worry about PR-history merging).
- **Jun 23** session: 2 movements — Snatch Pull (1 rep/round) + Power Snatch (2 reps/round), same weight per round.
- Neither movement currently has real PR history (first-ever log for both) — **intentionally left as-is**, user decided not to auto-flag first-time logs as PRs (see "Key decisions" below).
- A temporary test PR was added to Split-Stance Press earlier to verify PR-row rendering, then deleted afterward — Movements list should currently show zero PRs for it again (confirm this is still true if picking this thread back up, in case the delete didn't fully land).

**Key decisions already made (don't re-ask):**
- Single vs Multi is an explicit per-session flag (`strengthBlock.mode`), not just inferred — but the inference heuristic (`resolveStrengthMode`) is still used for legacy sessions without the flag, and deliberately shared between `LogScreen.jsx` (so editing a legacy multi-set session pre-selects "Multi") and `SessionDetailScreen.jsx` (so it displays correctly) to avoid the flag silently reverting to "single" on an unrelated edit+save.
- Column headers show abbreviated names (not letters A/B/C, not literal movement names) — numbers only as a fallback for 4+ movements or abbreviation collisions.
- Legend above the table always uses plain numbers (1, 2, 3...) + full movement names, regardless of column-header fallback state.
- PR display: icon+"PR" text (not just icon) next to the round number when any movement in that round is a PR; the specific movement's cell (not the whole row) turns teal. Same treatment applies to single-movement view's `SetRows`.
- Single-movement view (not multi) was redesigned too: right-anchored "N reps" / "N lbs" columns (not the "xN · weight" dot format — that's Multi-only), pushed toward the right edge with a flexible spacer before them, not centered/spread full-width.
- A movement's first-ever log should **not** auto-count as a PR (user explicitly confirmed leaving this gap alone).
- Reminder: Bash is permanently blocked in this environment — use Read/Edit/Write only, and `mcp__Claude_Preview__*` tools for the dev server (already configured, server name `workout-tracker`). Give the user the full `cd ".../Workout Tracker" && git add ... && git commit ... && git push` command after each change; they run it themselves. Always bump both the version badge in `HomeScreen.jsx` and the `CACHE` name in `public/sw.js` before writing that commit.

---

## Project Overview

A personal Progressive Web App (PWA) for tracking CrossFit/BB WOD workouts. Built for one user (Leanna), installed to iPhone home screen, no App Store. The app replaces Hevy for strength tracking and adds structured metcon logging. Claude AI is deeply integrated for photo parsing, natural language input, and intelligent suggestions.

**Program:** BB WOD — barbell strength + conditioning, 3–4x/week at a gym in Los Gatos, CA. Each session typically has a strength piece and a metcon.

---

## PWA Requirements

- `display: standalone` in web manifest — no Safari browser chrome when launched from home screen
- `viewport` meta tag: `width=device-width, initial-scale=1, viewport-fit=cover`
- Safe area insets respected (`env(safe-area-inset-*)`) for iPhone notch/Dynamic Island
- Status bar style: black-translucent
- App icons provided at 192x192 and 512x512
- Offline-capable for viewing past sessions (service worker)
- All interactions designed for thumb reach on iPhone — primary actions bottom-anchored

---

## Tech Stack

- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **Storage:** IndexedDB via Dexie.js (local, no backend required)
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`) — API key stored in `.env.local` as `VITE_ANTHROPIC_API_KEY`
- **Camera/Photo:** Native browser file input with `capture="environment"` for whiteboard photos

---

## Design Direction

Native iOS aesthetic. The app should feel indistinguishable from a real iOS app when saved to the home screen.

- **Color palette:** Dark mode only. Deep near-black background (`#0a0a0a`), card surfaces at `#201a2a` (deep purple-black), primary accent is teal (`#0ff7c5`) — used for labels, active states, and primary action buttons. Secondary accent: a muted red (`#e05c4b`) for PRs only. **No white buttons anywhere** — the teal replaces chalk-white as the action color.
- **Button rules:** Primary CTA → solid teal (`#0ff7c5`) background with black text. Selection pills (active) → `rgba(15,247,197,0.14)` bg with `#0ff7c5` text. Secondary/ghost buttons → `rgba(255,255,255,0.07)` bg with dimmed warm-white text. Destructive → `rgba(255,59,48,0.12)` bg with `#ff6b5e` text.
- **Typography:** SF Pro stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display'`). Heavy weights for numbers/weights, regular for labels.
- **Layout:** Bottom tab bar (5 tabs max), no hamburger menus. Cards with 14px radius. Swipe gestures where native iOS would have them.
- **Motion:** Subtle — iOS-style spring transitions on navigation, nothing gratuitous.
- **Signature element:** Weight numbers displayed large and bold, like a scoreboard. When you log a PR, a brief chalk-dust animation fires.

---

## Navigation (Tab Bar)

1. **Home** — recent sessions feed
2. **Log** — start a new session (primary action)
3. **Movements** — movement library, PR tracker, history per movement
4. **Trends** — charts and Claude-powered insights
5. **Settings** — PRs baseline, preferences

---

## Data Model

### Session
```
{
  id: uuid,
  date: ISO date string,
  program: string (default "BB WOD"),
  strengthBlock: StrengthBlock | null,
  metconBlock: MetconBlock | null,
  notes: string,
  whiteboardPhotoUrl: string | null,  // base64 stored locally
  createdAt: timestamp
}
```

### StrengthBlock
```
{
  title: string,           // e.g. "Power Snatch Build" or "Back Squat"
  structure: string,       // e.g. "12 min EMOM x2", "5x5", free text
  movements: Movement[],
  notes: string
}
```

### Movement (within a session)
```
{
  name: string,            // normalized, e.g. "Power Snatch"
  sets: Set[],
  notes: string
}
```

### Set
```
{
  setNumber: number,
  reps: number | null,
  weight: number | null,   // in lbs
  weightUnit: "lbs" | "kg",
  isFailure: boolean,
  isPR: boolean,
  notation: string | null  // e.g. "HAP", "build", "@ 80%", free text
}
```

### MetconBlock
```
{
  format: "AMRAP" | "For Time" | "OTM" | "EMOM" | "Tabata" | "Other",
  duration: number | null,   // in minutes
  rounds: number | null,     // for AMRAP result
  timeCap: number | null,
  score: string | null,      // flexible: "12 rounds + 5 reps", "14:32", etc.
  movements: MetconMovement[],
  notes: string
}
```

### MetconMovement
```
{
  name: string,
  reps: number | string | null,  // string for "max", "AMRAP", etc.
  weight: number | null,
  weightUnit: "lbs" | "kg",
  minuteAssignment: number | null,  // for OTM: which minute (1, 2, 3...)
  notes: string | null
}
```

### MovementRecord (global, for PR tracking)
```
{
  name: string,             // canonical movement name
  aliases: string[],        // e.g. ["PS", "P.SN"] for Power Snatch
  category: "weightlifting" | "gymnastics" | "cardio" | "strength" | "other",
  prs: PR[]
}
```

### PR
```
{
  date: ISO date string,
  reps: number,
  weight: number,
  weightUnit: "lbs" | "kg",
  sessionId: uuid
}
```

---

## PR Baseline (seed on first launch)

```json
[
  { "name": "Back Squat", "prs": [{ "date": "2026-06-05", "reps": 1, "weight": 120, "weightUnit": "lbs" }] },
  { "name": "Front Squat", "prs": [{ "date": "2026-06-08", "reps": 3, "weight": 100, "weightUnit": "lbs" }] },
  { "name": "Power Snatch", "prs": [{ "date": "2026-06-12", "reps": 2, "weight": 57, "weightUnit": "lbs" }] }
]
```

---

## Daily Workflow

1. Open app → Home screen with prominent "Start Workout" button
2. Tap Start Workout → camera opens for whiteboard photo
3. Photo captured → Claude parses → session UI generated with strength and metcon blocks pre-filled
4. **Strength block:** movements and rep schemes pre-filled; working sets pre-generated based on parsed structure (e.g. "12 min EMOM x2" = 6 rows); user enters weight per set as they go; warmup sets can be added above working sets
5. **Metcon block:** movements pre-filled; one weight input per movement (not per round); score field appropriate to format (time field for For Time, rounds+reps field for AMRAP, etc.)
6. **Notes field** available throughout
7. Tap "Log Workout" → PR check → save → return to Home

---

## Screen Specs

### 1. Home Tab

- Header: today's date
- Prominent "Start Workout" button at top (or bottom CTA if no session today)
- Recent sessions list (reverse chronological), each card shows:
  - Date
  - Strength block title + top weight hit
  - Metcon format + score
  - PR badge if any PRs hit that day
- Tap session → Session Detail view

### 2. Log Flow (New Session)

**Step 1 — Whiteboard Photo**
- Camera opens immediately on tapping "Start Workout"
- On photo capture → Claude API parses → returns pre-filled workout structure
- User can skip photo and enter manually
- Parsed result shown with ability to edit before proceeding

**Step 2 — Strength Block**
- Title field (pre-filled from parse)
- Structure field — free text (e.g. "12 min EMOM x2")
- Per movement:
  - Movement name (pre-filled, editable)
  - **Warmup sets:** "Add Warmup Set" button above working sets; warmup rows styled visually distinct (muted, smaller); warmup sets excluded from PR detection and volume trends
  - **Working sets:** pre-generated rows based on parsed structure; each row has: set number, reps (pre-filled if known), weight (blank — user fills in)
  - If number of rounds is ambiguous from parse, start with 1 row and show "Add Set" button
  - "Last time" chip per movement: "Last: 3x5 @ 95 lbs (Jun 5)"
  - "Suggest" button → Claude recommends weight with 1–2 sentence reasoning
  - Notes field per movement
- Notes field for full strength block

**Step 3 — Metcon Block**
- Format pre-filled from parse (AMRAP / For Time / OTM / EMOM / Other)
- Duration field (pre-filled if known)
- Per movement: name, reps (pre-filled), single weight field (one weight for the whole metcon, not per round)
- For OTM/EMOM: movements labeled with their minute assignment (Min 1, Min 2, etc.)
- Score field — adapts to format:
  - For Time → time input (MM:SS)
  - AMRAP → rounds + reps fields
  - OTM/EMOM → completion toggle or notes
  - Other → free text
- Notes field for metcon block

**Step 4 — Log Workout**
- Accessible "Log Workout" button throughout (sticky footer or clearly visible)
- On tap: PR detection runs, session saved to IndexedDB
- PR celebration if applicable (chalk-dust animation)
- Return to Home

### 3. Movements Tab

- Searchable list of all movements ever logged
- Tap movement → Movement Detail:
  - All-time PR (1RM, 3RM, 5RM etc. — show best for each rep count)
  - Volume chart over time
  - All logged sets (date, sets, reps, weights)
  - Notes history

### 4. Trends Tab

- Weekly volume chart (total lbs lifted)
- Workout frequency (days/week rolling average)
- Movement frequency heatmap (what you've been doing most)
- **Ask Claude section:** free text input — "How has my Power Snatch been progressing?" or "What movements haven't I done in a while?" — Claude gets full session history as context and responds conversationally

### 5. Settings Tab

- Edit PR baselines
- Preferred weight unit (lbs / kg)
- Movement aliases manager (so "P.SN" and "PS" both map to "Power Snatch")
- Export data (JSON)
- Clear all data (with confirmation)

---

## Claude API Integration

### API Setup
```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [...]
  })
});
```

### Integration Points

**1. Whiteboard Photo Parse**
- Send image as base64 with prompt asking for structured JSON
- Prompt specifies the expected output schema (strength block + metcon block)
- Handle common CF notation: OTM, EMOM, AMRAP, HAP, build, P.SN, DL, etc.
- Return partial data gracefully if photo is unclear

**2. Natural Language Set Entry**
- User input + current movement context → Claude returns structured set data

**3. Weight Suggestion**
- Input: movement name + full set history for that movement
- Output: recommended weight + brief reasoning (2 sentences max)
- Example: "Last time you hit 95 lbs for 3x5 clean. For today's build sets, start around 75 and aim for 100–105 on your top set."

**4. Trends / Ask Claude**
- Input: full session history (last 60 days) + user question
- Output: conversational response, can include specific data points
- Keep responses concise — this is a mobile app, not a chat interface

### Prompt Guidelines
- Always return structured JSON for parsing use cases — instruct model explicitly
- Include user's PR baseline in context for weight suggestions
- For photo parsing, include example of expected output format in prompt
- Graceful degradation: if Claude call fails, app still works — just loses AI features

---

## Key Behaviors & Edge Cases

- **No assumed rep schemes:** When starting a new set, fields are blank. Previous data shown as a reference chip, never auto-filled.
- **Free sequencing:** Movements can be logged in any order. No concept of a "superset" that must be completed before moving on.
- **HAP / Build notation:** Preserved as a text notation on sets. Not a blocker for logging.
- **PR detection:** After saving a session, app checks each set against MovementRecord PRs. If any set beats the current PR for that rep count, it's flagged and the MovementRecord is updated.
- **Movement name normalization:** Common abbreviations mapped on input. "DL" → "Deadlift", "P.SN" → "Power Snatch", "FS" → "Front Squat", "BS" → "Back Squat", "C&J" → "Clean & Jerk". User can add custom aliases in Settings.
- **Empty state:** Home screen with no sessions has a friendly prompt to log first workout, not a blank screen.

---

## File Structure

```
/src
  /components
    /shared       — Button, Card, Input, BottomSheet, etc.
    /home         — SessionCard, HomeScreen
    /log          — WhiteboardCapture, StrengthLogger, MetconLogger, ReviewScreen
    /movements    — MovementList, MovementDetail, PRBadge
    /trends       — Charts, AskClaude
    /settings     — SettingsScreen
  /hooks
    useSession.js
    useMovements.js
    useClaude.js   — all Claude API calls
  /db
    db.js          — Dexie schema and seed data
  /utils
    normalization.js  — movement name aliases
    prDetection.js
  App.jsx
  main.jsx
/public
  manifest.json
  icons/
index.html
.env.local         — VITE_ANTHROPIC_API_KEY=your_key_here (gitignored)
```

---

## Getting Started (for Claude Code)

1. `npm create vite@latest workout-tracker -- --template react`
2. `cd workout-tracker && npm install`
3. `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`
4. `npm install dexie uuid`
5. Set up PWA manifest in `/public/manifest.json`
6. Build Dexie schema and seed PR data first
7. Build tab navigation shell
8. Build Log flow (most important screen)
9. Add Claude API integration via `useClaude.js` hook

**Always test in iPhone Safari or Chrome DevTools mobile viewport. This is a mobile-first app.**
