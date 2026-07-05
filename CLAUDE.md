# Workout Tracker — Claude Code Spec

## Multi-Set Strength Table — column alignment RESOLVED (v190 / bb-wod-v165)

**Two separate bugs, fixed in two passes — both were real, don't reintroduce either:**

1. **Text not centered within its own cell (fixed in v189):** `MultiSetCell`'s root `div` has a fixed `width: 90` (to keep the dot position consistent across rows) and relies on the parent column's `justifyContent: 'center'` to center that box in the column — but the 90px box itself didn't set `justifyContent`, so its children (reps/dot/weight) defaulted to `flex-start` and packed against the box's left edge. Fixed by adding `justifyContent: 'center'` to that root div (`SessionDetailScreen.jsx:460`).
2. **Columns themselves were unequal width (the actual remaining complaint, fixed in v190):** the per-column wrapper div in `renderRow` (`SessionDetailScreen.jsx:488`) is `flex: 1`, which should divide the row equally — but a flex item's *automatic* minimum width is based on its content's min-content size, and `MultiSetCell`'s fixed `width: 90` child (present only on columns with a weight, e.g. RDL/SS Press) forced that column's min-content floor above its fair share, stealing space from the columns without a weight (e.g. bodyweight-only I Row). Measured on the Jun 16 3-column session: columns came out **92px / 78px / 92px** instead of an even ~87px each, so the data-row divider lines didn't line up with the header row's (which *were* evenly divided, since header cells have no fixed-width child forcing this). Fixed by adding `minWidth: 0` to that column div, which neutralizes the automatic-minimum-size behavior and lets `flex: 1` actually divide evenly — verified all rows now measure exactly 87px per column with content centers within ~1px of column center.

**Lesson for next time:** don't trust that a header row and a data row are aligned just because both individually "look centered" — measure column *width* (not just content-vs-column centering) on an actual data row with mixed weight/no-weight movements, since that's what exposes an uneven flex-basis floor.

**What this feature is:** strength sessions with 2+ movements done together as a superset (e.g. Snatch Pull + Power Snatch, one round = both movements at once) now render as a combined table instead of stacked separate movement blocks. Toggle in Log/Edit screen: **Single** vs **Multi** (separate from the existing Traditional/OTM toggle).

**Key files/functions:**
- `src/utils/movements.js` — `resolveStrengthMode(block)` (decides single vs multi display: explicit `block.mode`, else legacy heuristic on equal *working*-set counts across movements — warmups are independent per movement, not synced), `abbreviateForColumn(name)` (column header abbreviations, reuses `SESSION_ABBREV` for RDL/SDHP/G2OH first).
- `src/screens/SessionDetailScreen.jsx` — `MultiSetStrengthTable` (the read-only combined table), `MultiSetCell` (dot-aligned "x8 · 85 lbs" cell), `PRBadgeLabel` (icon+"PR" text, shared with single-movement `SetRows`), `computeSetPRStatus` (shared PR lookup), `MULTI_LABEL_COL_WIDTH` (currently 44, fixed-width round#/PR column), `DIVIDER_BORDER` (border-based column dividers — replaced an earlier absolute-positioned overlay approach that didn't account for row padding/gaps correctly).
- `src/screens/LogScreen.jsx` — `MultiSetStrengthInput` (the synced-round input UI for Multi mode), `strengthMode` state, `handleStrengthModeChange`, `addMultiRound`/`addMultiWarmupRound`/`removeMultiRound`/`addMultiMovement`/`updateMultiRoundChecked` mutators, `ImplementSelector` (now defaults BB pill active for known barbell lifts via `BB_STRENGTH_MOVEMENTS`, but not for bodyweight movements — takes a `name` prop now).

**Gotcha when measuring this table:** `document.querySelectorAll` text matches duplicate easily (e.g. "RDL" appears both in the Home screen's background movement chips AND in the detail overlay's table) — scope queries to the detail overlay container first, e.g. by finding the legend text and calling `.closest()`. Also: a header/cell *container's* bounding rect can look column-width-sized even when the actual visible text inside it is off-center — measure the innermost text-bearing element's rect, not just its wrapping flex box, or a left/right-packing bug like the one above will hide from you.

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
