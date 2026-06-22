# Workout Tracker — Claude Code Spec

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
