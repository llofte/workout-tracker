# Workout Tracker — Claude Code Spec

## In-progress log/edit sessions now survive app restarts — RESOLVED (v212 / bb-wod-v187)

**User-reported data loss:** started logging a workout, forgot to hit "Log Workout," and came back a day later to find the whole in-progress session gone. Root cause: `logging`/`editingSession`/`logMinimized` in `App.jsx` were plain React state — purely in-memory. Minimizing (the existing mini-player pattern) kept `LogScreen` mounted and preserved state *within the same page load*, but a killed tab, an iOS-purged backgrounded PWA, or just closing the app lost everything with no recovery path.

**Fix — localStorage-backed autosave, new `src/utils/draftStorage.js`** (`loadDraft`/`saveDraft`/`clearDraft`, key `bb-wod-draft-v1`):
- `LogScreen.jsx`: extracted the object literal `handleLog()` used to build for saving into a standalone `buildSessionData()` (same shape as a saved DB row — title, date, strengthBlock, metconBlock, accessoryBlock, notes). `handleLog()` now just calls it. A new debounced (600ms) `useEffect` — keyed on every meaningful piece of form state, firing only once `step === 2` — calls `buildSessionData()` and writes it to `localStorage` via `saveDraft()`, tagging `draft.id = initialSession.id` when editing an existing session (so update-vs-insert semantics survive the round-trip) and leaving `id` absent for a brand-new session (so it still inserts correctly on eventual save).
- `App.jsx`: reads `loadDraft()` once on mount; if present, seeds `editingSession` with it directly and opens straight into the **minimized** "Workout in Progress" bar (not full-screen) so reopening the app doesn't interrupt whatever the user actually came to do — tap to expand and continue, or the existing ✕ to discard. `closeLog()` (Cancel / mini-bar ✕) and `handleSave()` (successful save) both call `clearDraft()`, so the two existing "leave the log flow" paths already double as "discard/consume the draft" — no new UI needed.
- Reused the *existing* edit-session hydration path end to end: since a resumed draft (whether brand-new or mid-edit) is already shaped exactly like a saved session, passing it as `initialSession` means every existing `useState` initializer (`restoreStrengthMove`, `restoreMetconMove`, `parseStrengthStructure`, etc.) hydrates it correctly with **zero new bypass logic** — the only genuinely new code is the autosave effect itself and the resume-on-boot wiring in `App.jsx`.
- Two label checks (`initialSession ? 'Edit Session' : 'Log Workout'`, and the footer Save/Log button + Saving/Logging text) were tightened to `initialSession?.id` specifically, so a resumed brand-new-workout draft (no `id`) still correctly reads "Log Workout"/"Logging…" rather than "Edit Session"/"Save Changes" — matches the convention `handleLog()` itself already used. The footer's "Cancel" button intentionally kept its broader `initialSession &&` check unchanged, so resumed drafts (new *or* edit) get an explicit discard affordance that a from-scratch new-workout flow never had — a deliberate, harmless bonus, not an oversight.

**Verified live**, simulating a killed tab via a full page reload (not just minimizing within the same load):
1. Started a new workout, typed a strength movement name, confirmed the draft landed in `localStorage` after the debounce.
2. Reloaded the page cold — the "Workout in Progress" bar appeared automatically with no prompt, Home's "Log Workout" correctly disabled. Expanded it — every typed field, including the movement name, was intact; header correctly read "Log Workout" (not "Edit Session").
3. Hit Cancel — draft cleared from `localStorage`, mini-bar gone, Home's CTA re-enabled.
4. Opened Edit on a real saved session (id `bc3dfa4f-...`), confirmed the autosaved draft carried the correct `id`, reloaded cold, confirmed it resumed correctly labeled "Edit Session" with the real title fields intact, then Cancelled — draft cleared, **real session data left untouched** (Cancel never calls Supabase).

---

## Metcon volume undercounted when segment `rounds` is null — RESOLVED (v211 / bb-wod-v186)

**Follow-up to the "0 min EMOM" and timed-hold fixes above** — flagged in passing while fixing the hold-as-1-rep change, user confirmed: yes, fix it.

**Root cause:** `calcMetconVol()` (`SessionDetailScreen.jsx`) and `sessionVolume()` (`HomeScreen.jsx`) both compute a segment's round count as `seg.rounds || 1` with no fallback — so on any segment where Claude populated `duration` instead of `rounds` (the same gap behind the "0 min EMOM" bug), volume was computed for 1 round instead of the real count. This was the **`segments`-array branch**; the older flat-`movements`-array branch already had an equivalent duration→rounds fallback (`Math.floor(block.duration / slots)`) — the segments branch just never got the same treatment when segments were introduced.

**Fix:** both branches now derive `rounds` from `seg.duration / (seg.interval × occupied slots)` when `seg.rounds` is null and format is OTM — same fallback formula `segmentLabel()`/`metconSubtitle()` already use on the display side, just inverted for volume math (includes `interval` in the divisor, unlike the older flat-`movements` fallback, which is correct here since `interval` was directly available and mattering for non-1 intervals).

**Verified live** on the real 7/22 session: total went from 481 lbs (1 round, post-hold-fix but pre-this-fix) to **1,924 lbs** (correct 4 rounds — Cluster 3×52×4 + Plate Sit-Up 12×25×4 + Hold 1×25×4 = 1,924). Re-checked Jun 24 (single-segment, old flat-`movements` format) for regressions — unaffected, still 2,340 lbs, since that session doesn't use the `segments` array at all.

---

## Timed holds logged as reps instead of seconds — RESOLVED (v210 / bb-wod-v185)

**User correction:** a hold movement (e.g. "DB Front Rack Hold" for 30 seconds) was displaying "30 reps" and being volume-calculated as `30 × weight` — wildly overstating load, since 30 is a duration, not a rep count. User: "update this to be logged at seconds. As for calculating total load, consider it 1 rep in the background."

**Fix — two parts, in both `SessionDetailScreen.jsx` and `HomeScreen.jsx` (duplicate volume-calc logic, same pattern as every other fix in this file):**
1. `TIMED_RE` (previously `/\bplank\b/i`, matching only "Plank" movements — a known gap flagged earlier as deferred) widened to `/\bplank\b|\bhold\b/i` so any "...Hold" movement (Front Rack Hold, Overhead Hold, etc.) is recognized as timed, not just Plank. `HomeScreen.jsx` didn't have `TIMED_RE` at all (it doesn't render per-movement reps text) — added it there too since it's now needed for volume calc.
2. `addLoad()` (in `calcMetconVol` / `sessionVolume`) and `calcPartialRoundVol()` (AMRAP partial-round scoring) both now treat a `TIMED_RE`-matching movement's effective rep count as **1**, ignoring the actual stored number (which is seconds), for load-calculation purposes only — display (`formatReps`) still shows the real number with a "sec" suffix.

**Verified live** on the real 7/22 session: "DB Front Rack Hold" now shows "30 sec" (was "30 reps"), and the metcon volume dropped from 1,206 lbs to 481 lbs (removed the 30× inflation: was counting 30 reps × 25 lbs = 750 lbs from one hold alone). Re-checked the Jun 24 session's "Side Plank" (already matched the old `\bplank\b` regex) for regressions — unaffected, volume unchanged at 2,340 lbs.

**Found in passing, not fixed, flagged separately:** the corrected 481 lbs total is *still* wrong for an unrelated, pre-existing reason — `calcMetconVol`'s non-AMRAP branch computes rounds as `seg.rounds || 1`, with no fallback to duration-derived rounds the way the title/subtitle logic now does (see the "0 min EMOM" fix above). Since this segment's `seg.rounds` is null (same Claude-populated-`duration`-not-`rounds` root cause), volume is being computed for **1 round instead of the actual 4**, undercounting Cluster/Sit-Up/Hold contributions by 4×. This was masked before today's fix by coincidence (the hold's 30-rep inflation happened to roughly cancel out the missing 3 rounds). Not fixed here — changing volume math retroactively affects historical totals across potentially many sessions and deserves an explicit decision, not a silent bundle-in.

---

## `minuteSpan` label misaligns movement names — RESOLVED (v209 / bb-wod-v184)

**Bug:** in `MetconMoveRow` (`SessionDetailScreen.jsx`), the "Min X" label span only had `minWidth: 34`, not a fixed `width`. A short label like "Min 3" fits within 34px, but "Min 1-2" (from a `minuteSpan` movement) is wider than 34px and grows the span past it — since the movement-name span next to it is `flex: 1` starting immediately after, this pushed movement names in `minuteSpan` rows further right than movement names in plain single-minute rows within the same segment, breaking the intended vertical alignment (e.g. "Row" appeared indented relative to "Cluster").

**Fix:** changed to a real fixed `width: 46` (comfortably fits "Min 1-2" and similar) with `whiteSpace: 'nowrap'`, replacing `minWidth: 34` — every label now occupies the exact same box regardless of content length, so movement names always start at the same x position. Verified live on the real 7/22 session — "Row" and "Cluster" (and every row in the second segment) now line up exactly.

---

## Multi-segment OTM naming convention — RESOLVED (v208 / bb-wod-v183)

**User feedback on the "0 min EMOM" fix below:** the fix initially made `metconSubtitle()` (top-of-card / section-subtitle label) sum each segment's work minutes into one total (e.g. "24 min EMOM" for two 12-min EMOMs separated by a 2-min rest). User pointed out this is misleading — it wasn't a single continuous 24-minute block, it was two 12-minute EMOMs + 2 min rest = 26 min elapsed. Correct convention: **"12 min EMOM ×2"** (each segment's own duration ×segment count), not a summed total — this already matched what `HomeScreen.jsx`/`LogScreen.jsx` were doing (they had an `allSame` check producing the `×N` format), so `metconSubtitle()` was actually the odd one out. Fixed by giving it the same `allSame` branching: `${segDurations[0]} min ${label} ×${segments.length}` when every segment's computed duration matches, falling back to a summed total only when segments genuinely differ in length.

**Per-segment mini header convention:** each segment's own label inside the Metcon/Accessory card (`segmentLabel()` in `SessionDetailScreen.jsx`) previously rendered `"N Rounds · EMOM"` when `seg.rounds` was populated, or bare `"EMOM"` when it wasn't — and on the real 7/22 session it wasn't (same root cause as the "0 min EMOM" bug: Claude populated `duration` per segment, not `rounds`), so both segments silently showed just "EMOM" with no round count at all. Changed to: (1) reorder to **"EMOM · N Rounds"** per user's preference, (2) derive rounds from `duration ÷ (interval × occupied slots)` when `seg.rounds` is null, so the round count always shows regardless of which field Claude happened to populate. Now reads "EMOM · 4 Rounds" for both segments on the real session.

**Verified live** against the real 7/22 session (top title, Home list, and both per-segment mini headers all correct) and re-checked the Jun 24 session (single-segment E5MOM, no rest-between-segments) for regressions — unaffected, still "20 min E5MOM" with no per-segment header (single-segment sessions don't render one).

---

## "0 min EMOM" on real multi-segment-with-rest OTM sessions — RESOLVED (v207 / bb-wod-v182)

**Found on real, live user data** (not test data): the actual 7/22 whiteboard session, logged for real via photo-parse, displayed "0 min EMOM" on both the Home list and session detail. Root cause: Claude's photo-parse populated `duration: 12` per segment but left `rounds: null` (the board said "4 rounds" for the second EMOM, but Claude pre-computed total segment minutes into `duration` instead of transcribing the round count literally). The multi-segment-with-rest duration math in every copy of this logic computed `(s.rounds || rounds || 0) * iv * slots` — with no fallback to `s.duration`/`duration` when rounds is unavailable on both the segment and the block, this collapsed to `0`.

**Four separate duplicate copies of this exact calculation existed, all had the identical gap, all fixed identically** (add `if (r) return r*iv*slots; return s.duration || duration || 0`):
- `SessionDetailScreen.jsx` `metconSubtitle()`'s `hasRest` branch.
- `LogScreen.jsx` `titleMetcon` state initializer's `hasRestBetween` branch.
- `LogScreen.jsx` `generateSessionTitle()`'s `hasRestBetween` branch.
- `HomeScreen.jsx` `deriveSessionParts()`'s `hasRestBetween` branch — this one was a **fourth, previously-unknown copy**, found only because after fixing the first three the session detail page correctly showed "24 min EMOM" while the Home list still showed "0 min EMOM" for the same session. It also had its own inline minute-slot counting (a raw `Set` over `minuteAssignment` values) instead of calling the shared `occupiedMinuteSlotCount()` — replaced with the shared helper too, so it now also respects `minuteSpan`.

**Verified against the real session** (Home list and detail page both, via the running dev server against production Supabase) — now shows "12 min EMOM ×2" / "24 min EMOM" — **without editing or deleting the underlying session data**; this was a pure display-logic fix, the stored row was never touched. Also re-checked the Jun 24 session (Pattern B grouped OTM, another multi-segment-with-rest case) for regressions — still correctly shows "20 min E5MOM".

**Lesson for next time:** when the same calculation is duplicated across files (this feature now has this exact duration math in four places), grep for the distinctive computation shape (not just the function name) before declaring a fix complete — `deriveSessionParts` exists in both `HomeScreen.jsx` and `SessionDetailScreen.jsx` as two independently-written functions with the same name, easy to miss one.

---

## Implement baked into metcon/accessory movement names — RESOLVED (v207 / bb-wod-v182)

**User request:** "OH Plate Sit-Up should log as 'Sit-Up' with Plate selected as weight. OH can be ignored for this movement. KB Front Rack Hold should log as 'Front Rack Hold' with KB selected." — both from the same 7/22 whiteboard photo.

**Two-part fix:**
1. `ALIAS_MAP` (`src/utils/movements.js`) — added `'OH PLATE SIT-UP'`/`'OH PLATE SIT UP'`/`'OVERHEAD PLATE SIT-UP'`/etc. and `'PLATE SIT-UP'`/`'PLATE SIT UP'` variants, all mapping to `{ name: 'Sit-Up', implement: 'Plate' }` — the leading "OH"/"Overhead" is dropped entirely (not kept as a modifier) since it isn't meaningfully distinct from a plain plate sit-up for logging. "KB Front Rack Hold" already worked via the existing generic `IMPLEMENT_PREFIXES` regex stripping (no ALIAS_MAP entry needed) — confirmed via `normalizeMovement('KB Front Rack Hold')` → `{ name: 'Front Rack Hold', implement: 'Kettlebell' }`.
2. **The deeper gap:** metcon/accessory movements from photo-parse never got implement/singleArm/side auto-extracted at all — that machinery (`normalizeMovement` + implement mapping) only ran for *strength* movements (`restoreStrengthMove`), never for metcon ones, because Claude bakes the implement into the name string for metcon (`"KB Front Rack Hold"`) with no separate implement field, and nothing pulled it back out on the photo-parse path specifically. Fixed by extracting the shared logic into `normalizeMoveIdentity(m)` in `LogScreen.jsx` (used by both `restoreStrengthMove`/`restoreMetconMove` for the DB-restore path, and now also spread into every metcon/buyIn/buyOut move object in `handlePhotoSelect()`).

**Verified:** `normalizeMovement('OH Plate Sit-Up')` → `{ name: 'Sit-Up', implement: 'Plate' }`, `normalizeMovement('KB Front Rack Hold')` → `{ name: 'Front Rack Hold', implement: 'Kettlebell' }` (re-confirmed live against the running dev server via dynamic import, not just at implementation time). Not verified against a live Claude photo-parse call (would require spending real API credits on a fresh photo) — confidence comes from the identity-extraction function being identical to the already-proven strength-movement path, now just wired into one more call site.

**Known cosmetic gap, not fixed:** the actual 7/22 saved session predates this fix, so its stored movement names are still the older `normalizeMovement` output from before the ALIAS_MAP entries existed (shows "Plate Sit-Up" and "DB Front Rack Hold" rather than "Sit-Up"/plate-implement and "Front Rack Hold"/KB-implement). This is stored data, not recomputed on display — same category of issue as the `customTitle` staleness pattern documented elsewhere in this file. Note: that same session's Front Rack Hold implement is `"DB"` rather than `"KB"` — confirmed by the user this is an intentional manual override (used dumbbells instead of kettlebells), not a photo-parse transcription error. Implement mismatches vs. the board are not automatically bugs — don't assume without asking.

---

## OTM movements spanning multiple minutes (`minuteSpan`) — RESOLVED (v206 / bb-wod-v181)

**Edge case:** a whiteboard OTM can assign one movement to a *range* of minutes for one longer effort, not one movement per minute — e.g. "Min 1 & 2 x350/300m Row" means one 350/300m row with a 2-minute cap to finish it, then "Min 3 x3 Cluster" starts. This is meaningfully different from two separate 1-minute rows: duplicating the movement across `minuteAssignment: 1` and `minuteAssignment: 2` would double-count volume/distance, since volume calc multiplies each movement entry by the round count.

**Model:** added an optional `minuteSpan` field (number, defaults to 1) alongside `minuteAssignment` on metcon/accessory movements — one movement entry, `minuteAssignment` = first minute, `minuteSpan` = how many consecutive minutes it occupies. No duplication, no volume-calc changes needed (still exactly one entry per round).

**Touched every place `minuteAssignment` appears** (mapped via a research pass before editing, so nothing was missed):
- `src/utils/movements.js` — new shared `occupiedMinuteSlotCount(moves)`: counts distinct occupied OTM minute-slots across a movements list, expanding each movement by its `minuteSpan` (`minuteAssignment` through `minuteAssignment + minuteSpan - 1`) rather than just counting distinct `minuteAssignment` values. Used everywhere a segment's per-round OTM duration is derived (`rounds × interval × slots`). Works on both DB shape (numbers, field `movements`) and `LogScreen`'s form-state shape (numeric strings, field `moves`) — just pass the array.
- `SessionDetailScreen.jsx` — `metconSubtitle()` (both the multi-segment-with-rest branch *and* the single-segment branch — see bonus fix below), `calcMetconVol()`'s OTM-without-explicit-rounds branch, and `MetconMoveRow`'s display label (shows "Min 1-2" when `minuteSpan > 1`, plain "Min 1" otherwise). `AccessoryBlock` needed no separate fix — it calls the same `metconSubtitle()`.
- `LogScreen.jsx` — `newMetconMove()` default, `restoreMetconMove()` (DB → form), `titleMetcon` state initializer and `generateSessionTitle()` (both duplicate `metconSubtitle`-style duration math for the editable title field — same slot-counting fix applied to both), the save-path serialization (metcon *and* accessory segments both serialize `minuteSpan` alongside `minuteAssignment`), and a new "SPAN" input added next to every existing "MIN #" input (metcon normal-move row, accessory normal-move row — rest-move rows don't need it, rests use `restSeconds` for duration instead).
- Claude parsing prompts (`buildPhotoPrompt`, `buildGeneratePrompt`) — added `"minuteSpan": ""` to both JSON schema examples, and a new "PATTERN A variant" explaining the multi-minute-single-effort case, plus a clarified "key signal" distinguishing it from PATTERN B (grouped OTM, which uses `interval` for the whole rotation, not `minuteSpan` on one movement).

**Bonus bug found and fixed while doing this (pre-existing, unrelated to `minuteSpan` itself):** `metconSubtitle()`'s single-segment OTM branch computed duration as `rounds × interval` only — never multiplying by occupied-slot count at all. For any single-segment OTM with more than one minute-slot per round (rotating multi-movement OTM, or now a `minuteSpan` movement), this understated the duration. Confirmed on real historical data: the Jun 17 session (5 rounds, 4 distinct minute-slots across 5 movements — Pull-Up and Push-Up share `minuteAssignment: 1`) was displaying "5 min EMOM" before this fix, when its own stored `duration` field already said 20 — `5 rounds × 4 slots = 20`, matching. Now displays "20 min EMOM" correctly. Also verified against the Jun 24 session (Pattern B grouped OTM, all `minuteAssignment: null`) — `occupiedMinuteSlotCount` correctly falls back to 1 slot when no movement has a minute assigned, giving `4 rounds × 5 interval × 1 = 20 min`, matching its stored duration too. Checked both before shipping — no regression on either real session.

**Verified end-to-end against a real (temporary) test session**, not just unit-level: built an actual "Min 1 & 2 Row 350m, Min 3 Cluster, 4 rounds OTM" session through the live Log form (in the running dev server against production Supabase), saved it, confirmed the saved row has `minuteAssignment: 1, minuteSpan: 2` for Row and `minuteAssignment: 3, minuteSpan: null` for Cluster, confirmed the detail page renders "Min 1-2 Row" / "Min 3 Cluster" and the subtitle correctly shows "12 min EMOM" (4 rounds × 3 slots), then deleted the test session afterward.

**Debugging gotcha hit during this (costed significant time, worth remembering):** the Log form's real submit button and the Home screen's own "Log Workout" CTA button have **identical visible text** ("Log Workout") and can both be present in the DOM at the same time (Home's CTA sits underneath the Log overlay). `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log Workout'))` matches whichever comes first in DOM order — which was the wrong (and often disabled, e.g. while `logInProgress`) one. This made the real submit button look permanently disabled and silently no-op for many attempts. Fix: when multiple buttons share text, disambiguate by filtering on `!b.disabled` or on a distinguishing style/attribute, not just text content.

## Movement-name title consistency scrub — RESOLVED (v205 / bb-wod-v180)

**Rule requested by user:** for any title/subtitle combining multiple STRENGTH movement names, use full names for every movement if the full-name string fits on one line; otherwise abbreviate every movement — never mix full and abbreviated names in the same title.

**Three call sites found and unified** (via a new shared `buildMultiMoveTitle(movements, { font, maxWidth })` in `src/utils/movements.js`, replacing three previously-independent, inconsistent implementations):
1. `SessionDetailScreen.jsx` `deriveSessionParts()` — the page-top "💪 ..." title. Previously `.slice(0,2)` + always-full `toWorkoutDisplay`.
2. `SessionDetailScreen.jsx` `StrengthBlock`'s `subtitle` — previously always-abbreviated via `abbreviateForColumn`, all movements (no slice), but never full even when short.
3. `HomeScreen.jsx` `deriveSessionParts()` (a separate, duplicate function from #1) — same `.slice(0,2)` + always-full bug as #1.

**How `buildMultiMoveTitle` decides:** builds the full-name string (`toWorkoutDisplay(m, { abbreviate: false })` for every movement — see gotcha below), measures it via `measureTextWidth` (canvas-based, exported from `movements.js`) against the caller's actual font + available width (`window.innerWidth` minus that call site's known horizontal padding — 40px page title, 72px subtitle, 32px Home card), and returns it if it fits; otherwise returns the fully-abbreviated string (`abbreviateForColumn(normalizeMovement(m.name).name)` for every movement). Single-movement titles are untouched (still just `toWorkoutDisplay(moves[0])`) since there's no mixing risk with one name.

**Real bug found and fixed:** the first implementation of `buildMultiMoveTitle` built its "full" candidate with plain `toWorkoutDisplay(m)` (default `abbreviate: true`) — since `toWorkoutDisplay` *always* substitutes `SESSION_ABBREV` entries (RDL, Inv Row, Sn Pull, SDHP, G2OH) regardless of context, the "full" string was already partially abbreviated for any movement that happened to be in that map, while non-mapped movements stayed full — producing exactly the reported mixed inconsistency, just one level deeper than the original per-call-site bugs. Fixed by passing `{ abbreviate: false }` explicitly when building the full candidate.

**Gotcha that cost significant debugging time:** after fixing the code, the Jun 16 test session *still* showed the old mixed title ("RDL + Inverted Row + SS Press") on every reload. The dynamic logic was actually correct by that point (verified in isolation via `await import('/workout-tracker/src/utils/movements.js?bust=...')` in the browser console with the session's real movement data) — the actual cause was that `session.strengthBlock.customTitle` was **persisted in the database** with that exact stale string (likely auto-saved by an older version of this same title logic during earlier testing in this session), and `customTitle` always takes precedence over the dynamic computation in both `deriveSessionParts` and `StrengthBlock`. Cleared it via the Edit screen's "Strength title" field (blank = fall through to dynamic logic) to confirm the fix end-to-end. **If a title looks wrong after a code fix here, check `strengthBlock.customTitle` in the actual session data before assuming the logic is still broken** — inspect via React fiber (`el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))]`, walk `.return` until `memoizedProps.session` appears) rather than re-guessing at the code.

**Not yet done — needs user decision:** this same stale-`customTitle` issue may exist on the user's *real* (non-test) session history, not just this one test session, since `customTitle` is a user-editable override field and I can't safely distinguish "genuinely user-typed custom title" from "stale auto-generated text that happens to look custom" without asking. Have not bulk-scanned/cleared real production sessions for this — flag to user before doing so.

---

## SwipeBack "freely draggable after pause" — WORKED AROUND, not truly fixed (v199 fix, v200 / bb-wod-v175 cleanup)

**⚠️ This is a hack, not a real fix — user has flagged they may want to revisit it for a proper solution.** "Fixed" below means "the symptom no longer reproduces," not "the root cause is understood or corrected." Read the whole entry before touching `SwipeBack.jsx` again.

**What makes it a hack, specifically:**
- **Empirical, not diagnosed.** We know a real, painted, `position: fixed` element with actual dimensions prevents the freeze, and that a bare re-render and an invisible-but-real DOM mutation both don't — an A/B result, not a root-cause finding. The actual iOS/WebKit mechanism that's misbehaving was never identified.
- **A workaround, not a correction.** It doesn't touch whatever iOS process is actually failing (something about committing a `transform`/`transition` mid-touch-sequence) — it just keeps an irrelevant element painted on screen as a side effect that happens to prevent that process from misfiring.
- **Fragile against future refactors.** Nothing about `RepaintKeepalive`'s apparent purpose (an invisible overlay) signals that it's load-bearing. A well-intentioned cleanup that shrinks it, drops the `opacity: 0` trick for something that looks equivalent, or removes it as "dead code" could silently reintroduce the bug with no obvious signal.

**If revisiting this for a real fix:** the right next step is Safari Remote Debugging (Mac + cable, Safari → Develop menu → select the phone) during the actual repro, to see what iOS is doing at the moment of the freeze — compositing layers, whether the `transition` actually starts, timing of paint vs. touch events — rather than more black-box A/B toggling of `SwipeBack.jsx`'s structure, which is how the current hack was found and is why it's not understood.

**Symptom:** after tapping into a session from Home's Recent list, starting a left-edge swipe-back, stopping mid-drag, lifting that finger, then touching the page again — the whole screen became freely draggable in any direction with the Home screen visible behind it. Same failure mode as [[reference_ios_swipe_gesture_conflict]].

**History of guesses, in order, so this isn't repeated:**
- **v193 (wrong):** guarded against a second *simultaneous* finger. Repro is actually sequential (lift, then re-touch).
- **v194 (wrong):** theorized a non-edge tap was cancelling the in-flight snap-back transition via `setAnimating(false)`. Verified that specific JS-state mechanism directly — still didn't fix the on-device bug.
- **v195 (real structural finding, not the root cause):** `SessionDetailScreen` (opened from Home's Recent list) is the only screen rendered via `createPortal` wrapped in doubled nested divs — collapsed the redundant nesting. Didn't fix it, but changed the failure mode (page started freezing on lift instead of needing a second touch), showing v195 *did* change something about event/render timing.
- **v196 (accidentally fixed it):** added a **visible** on-screen debug log (`DebugOverlay` — real dimensions, `position: fixed`, actual text content, `zIndex: 99999`) that called `setDebugLog(...)` on every touch event, including ones that previously did nothing. User reported the bug was fixed *before even reading the log* — the overlay itself, not its content, was the fix.
- **v197 (wrong — disproved "any re-render fixes it"):** replaced the visible log with `const [, bump] = useState(0); bump(n => n+1)`, rendering nothing. Bug came back immediately. This proved a `setState` call that isn't referenced anywhere in JSX produces an identical render output — React's reconciler skips the real DOM commit when nothing differs, so this "nudge" never touched the DOM at all.
- **v198 (wrong — disproved "any real DOM mutation fixes it"):** rendered the nudge counter in a **zero-size** (`width: 0, height: 0, overflow: hidden`), `aria-hidden` span. Directly verified via `nudgeSpan.textContent` that this WAS a genuine DOM text mutation on every relevant touch (`"0" → "1" → "2"`) — yet the user confirmed the bug was still not fixed. This rules out "a real DOM mutation is sufficient" as the mechanism; something about the v196 overlay's actual on-screen *paint* (real dimensions, `position: fixed` relative to viewport, actual rasterized pixels) must matter, not just a DOM text change with zero layout footprint.

**v199 — fix confirmed on-device:** stopped trying to isolate the minimal mechanism and restored the exact known-working structure instead — brought back the debug overlay byte-for-byte identical to the v196 version that was confirmed fixed (same real fixed-position/full-width/padded/scrollable dimensions, same log calls at the same call sites, same text content updates) — the **only** change is adding `opacity: 0`. `opacity: 0` (unlike `width:0/height:0`) still causes the browser to paint/composite the element normally, just with a fully transparent result. **User confirmed this fixed the bug on-device.**

**Current state of `SwipeBack.jsx`:** the overlay component is now named `RepaintKeepalive` (was `DebugOverlay`), state/functions renamed `keepaliveLog`/`nudgeRepaint` (were `debugLog`/`logDebug`) to reflect that this is permanent production code, not leftover debug scaffolding — **but the runtime logic itself was left completely untouched** during that rename, verified again afterward via preview. **Do not delete, "clean up", or remove `opacity: 0` from `RepaintKeepalive` or its call sites in `start()`/`move()`/`end()`** — see the code comment on `RepaintKeepalive` for why. The exact iOS/WebKit mechanism (why a real painted `position:fixed` element with actual dimensions prevents the freeze, when neither a bare re-render nor a zero-size DOM mutation did) is still not understood. This is empirically required, cargo-cult-looking code that must survive future refactors of this file.

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
