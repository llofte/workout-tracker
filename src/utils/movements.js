// Alias map: uppercase raw name → canonical {name, implement?, modifier?, singleArm?}
// 'implement' is one of: 'Barbell' | 'Dumbbell' | 'Kettlebell' | 'Med Ball' | 'Band' | 'Plate'
// 'modifier' is a display-level prefix: 'Strict' | 'Banded' | 'Prisoner' | 'Split-Stance' | etc.
//   — do NOT use 'SA' here; single-arm is the structured 'singleArm' field below.
// 'singleArm' (boolean) — set true when the raw name indicates single-arm execution.
const ALIAS_MAP = {
  // ── V-Up variants ─────────────────────────────────────────────────────────
  'V-UPS':          { name: 'V-Up' },
  'V UP':           { name: 'V-Up' },
  'V UPS':          { name: 'V-Up' },
  'VUP':            { name: 'V-Up' },
  'VUPS':           { name: 'V-Up' },

  // ── Sit-Up variants ───────────────────────────────────────────────────────
  'WEIGHTED SIT-UP': { name: 'Sit-Up', implement: 'Med Ball' },
  'WEIGHTED SIT UP': { name: 'Sit-Up', implement: 'Med Ball' },
  'SIT-UPS':         { name: 'Sit-Up' },
  'SIT UPS':         { name: 'Sit-Up' },
  // "OH" (overhead) is dropped entirely here, not kept as a modifier — it's not
  // meaningfully distinct from a plain plate sit-up for logging purposes.
  'OH PLATE SIT-UP':       { name: 'Sit-Up', implement: 'Plate' },
  'OH PLATE SIT UP':       { name: 'Sit-Up', implement: 'Plate' },
  'OVERHEAD PLATE SIT-UP': { name: 'Sit-Up', implement: 'Plate' },
  'OVERHEAD PLATE SIT UP': { name: 'Sit-Up', implement: 'Plate' },
  'PLATE OVERHEAD SIT-UP': { name: 'Sit-Up', implement: 'Plate' },
  'PLATE OVERHEAD SIT UP': { name: 'Sit-Up', implement: 'Plate' },
  'PLATE SIT-UP':          { name: 'Sit-Up', implement: 'Plate' },
  'PLATE SIT UP':          { name: 'Sit-Up', implement: 'Plate' },

  // ── Overhead Lunge ────────────────────────────────────────────────────────
  'SA OH LUNGE':                    { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SA OVERHEAD LUNGE':              { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SINGLE ARM OVERHEAD LUNGE':      { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SINGLE ARM OVERHEAD LUNGE (L)':  { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SINGLE ARM OVERHEAD LUNGE (R)':  { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SINGLE-ARM OVERHEAD LUNGE':      { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SINGLE-ARM OVERHEAD LUNGE (L)':  { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'SINGLE-ARM OVERHEAD LUNGE (R)':  { name: 'Overhead Lunge', implement: 'Dumbbell', singleArm: true },
  'OH LUNGE':                       { name: 'Overhead Lunge' },
  'OVERHEAD PLATE LUNGE':           { name: 'Overhead Lunge', implement: 'Plate' },
  'OVERHEAD PLATE LUNGES':          { name: 'Overhead Lunge', implement: 'Plate' },
  'OH PLATE LUNGE':                 { name: 'Overhead Lunge', implement: 'Plate' },
  'PLATE OVERHEAD LUNGE':           { name: 'Overhead Lunge', implement: 'Plate' },

  // ── Front Rack Lunge → Walking Lunge ─────────────────────────────────────
  'FRONT RACK LUNGE':  { name: 'Walking Lunge' },
  'FRONT RACK LUNGES': { name: 'Walking Lunge' },

  // ── DB Snatch → merged into Snatch (implement: Dumbbell) ─────────────────
  'DB SNATCH':     { name: 'Snatch', implement: 'Dumbbell' },
  'SA DB SNATCH':  { name: 'Snatch', implement: 'Dumbbell', singleArm: true },
  'ALT DB SNATCH': { name: 'Snatch', implement: 'Dumbbell' },
  'DB SN':         { name: 'Snatch', implement: 'Dumbbell' },
  'ALT DB SN':     { name: 'Snatch', implement: 'Dumbbell' },

  // ── DB Step-Up ────────────────────────────────────────────────────────────
  'DB STEP-UP':  { name: 'Step-Up', implement: 'Dumbbell' },
  'DB STEP UP':  { name: 'Step-Up', implement: 'Dumbbell' },
  'DB STEP-UPS': { name: 'Step-Up', implement: 'Dumbbell' },
  'DB STEP UPS': { name: 'Step-Up', implement: 'Dumbbell' },

  // ── DB Plank Reach Through ────────────────────────────────────────────────
  'DB PLANK REACH THROUGH': { name: 'Plank Reach Through', implement: 'Dumbbell' },
  'DB REACH THROUGH':       { name: 'Plank Reach Through', implement: 'Dumbbell' },
  'ALT DB REACH THROUGH':   { name: 'Plank Reach Through', implement: 'Dumbbell' },

  // ── Lateral Sprawl Jump Over ──────────────────────────────────────────────
  'LATERAL SPRAWL DB JUMP':              { name: 'Lateral Sprawl Jump Over', implement: 'Dumbbell' },
  'LATERAL SPRAWL JUMP':                 { name: 'Lateral Sprawl Jump Over' },
  'LATERAL SPRAWL JUMP OVER DUMBBELL':   { name: 'Lateral Sprawl Jump Over', implement: 'Dumbbell' },
  'LATERAL SPRAWL JUMP OVER DB':         { name: 'Lateral Sprawl Jump Over', implement: 'Dumbbell' },
  'LATERAL SPRAWL JUMP OVER BARBELL':    { name: 'Lateral Sprawl Jump Over', implement: 'Barbell' },
  'LATERAL SPRAWL JUMP OVER BAR':        { name: 'Lateral Sprawl Jump Over', implement: 'Barbell' },
  'LATERAL SPRAWL JUMP OVER ROWER':      { name: 'Lateral Sprawl Jump Over', implement: 'Rower' },

  // ── Deficit Deadlift → modifier on Deadlift ───────────────────────────────
  'DEFICIT DEADLIFT':  { name: 'Deadlift', modifier: 'Deficit' },
  'DEF. DEADLIFT':     { name: 'Deadlift', modifier: 'Deficit' },
  'DEF. DL':           { name: 'Deadlift', modifier: 'Deficit' },

  // ── Single-Leg Deadlift ───────────────────────────────────────────────────
  'SINGLE LEG DEADLIFT':  { name: 'Single-Leg Deadlift' },
  'SINGLE-LEG DEADLIFT':  { name: 'Single-Leg Deadlift' },

  // ── Burpee variants ───────────────────────────────────────────────────────
  'BURPEES':              { name: 'Burpee' },
  'BURPEE BOX JUMP OVER': { name: 'Burpee Box Jump-Over' },
  'BURPEE BOX JUMPOVER':  { name: 'Burpee Box Jump-Over' },

  // ── Box variants ──────────────────────────────────────────────────────────
  'BOX JUMPS':     { name: 'Box Jump' },
  'BOX JUMP-OVER': { name: 'Box Jump Over' },
  'BOX JUMP OVER': { name: 'Box Jump Over' },

  // ── Plate Jump — "Plate" here is the object jumped onto (like Box Jump), not a
  // substitutable lifted implement, so it must NOT be stripped by the generic
  // implement-word fallback below. Explicit protection entry.
  'PLATE JUMP':  { name: 'Plate Jump' },
  'PLATE JUMPS': { name: 'Plate Jump' },

  // ── Lateral Burpee Over (object → implement field, same pattern as Lateral Sprawl
  // Jump Over above — the bare name normalizes as-is via the fallback path below) ───
  'LATERAL BURPEE OVER BAR':       { name: 'Lateral Burpee Over', implement: 'Barbell' },
  'LATERAL BURPEE OVER BARBELL':   { name: 'Lateral Burpee Over', implement: 'Barbell' },
  'LAT. BURPEE OVER BAR':          { name: 'Lateral Burpee Over', implement: 'Barbell' },
  'LATERAL BURPEE OVER ROWER':     { name: 'Lateral Burpee Over', implement: 'Rower' },
  'LAT. BURPEE OVER ROWER':        { name: 'Lateral Burpee Over', implement: 'Rower' },
  'LATERAL BURPEE OVER DB':        { name: 'Lateral Burpee Over', implement: 'Dumbbell' },
  'LATERAL BURPEE OVER DUMBBELL':  { name: 'Lateral Burpee Over', implement: 'Dumbbell' },
  'LATERAL BURPEE OVER PLATE':     { name: 'Lateral Burpee Over', implement: 'Plate' },
  'LATERAL BURPEE OVER KB':        { name: 'Lateral Burpee Over', implement: 'Kettlebell' },
  'LATERAL BURPEE OVER KETTLEBELL':{ name: 'Lateral Burpee Over', implement: 'Kettlebell' },

  // ── KB Swing / Russian KB Swing (Russian is a modifier on the same base move) ─────
  'KB SWING':         { name: 'KB Swing' },
  'BANDED SWING':     { name: 'KB Swing', modifier: 'Banded' },
  'BANDED SWINGS':    { name: 'KB Swing', modifier: 'Banded' },
  'RUSSIAN SWING':    { name: 'KB Swing', modifier: 'Russian' },
  'RUSSIAN SWINGS':   { name: 'KB Swing', modifier: 'Russian' },
  'RUSSIAN KB SWING': { name: 'KB Swing', modifier: 'Russian' },
  'RUSSIAN KB SWINGS':{ name: 'KB Swing', modifier: 'Russian' },

  // ── Gorilla Row (always KB) / Devil Press ─────────────────────────────────
  'GORILLA ROW':      { name: 'Gorilla Row', implement: 'Kettlebell' },
  'ALT GORILLA ROW':  { name: 'Gorilla Row', implement: 'Kettlebell' },
  'DB GORILLA ROW':   { name: 'Gorilla Row', implement: 'Kettlebell' },
  'KB GORILLA ROW':   { name: 'Gorilla Row', implement: 'Kettlebell' },
  'DEVIL PRESS':      { name: 'Devil Press' },
  'DB DEVIL PRESS':   { name: 'Devil Press' },
  "SA DEVIL'S PRESS": { name: 'Devil Press', singleArm: true },

  // ── Prisoner Step-Up ──────────────────────────────────────────────────────
  'PRISONER STEP-UP': { name: 'Step-Up', modifier: 'Prisoner' },
  'PRISONER STEP UP': { name: 'Step-Up', modifier: 'Prisoner' },

  // ── Split-Stance Press → base move is just "Press"; "Split-Stance" is a modifier,
  // single-arm is the structured singleArm field, not text baked into name/modifier ──
  'SPLIT STANCE SINGLE ARM PRESS':          { name: 'Press', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT-STANCE SINGLE-ARM PRESS':          { name: 'Press', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT STANCE SA PRESS':                  { name: 'Press', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT STANCE SINGLE ARM PRESS (KB)':     { name: 'Press', implement: 'Kettlebell', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT-STANCE SINGLE-ARM PRESS (KB)':     { name: 'Press', implement: 'Kettlebell', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT STANCE SINGLE ARM PRESS (DB)':     { name: 'Press', implement: 'Dumbbell', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT-STANCE SINGLE-ARM PRESS (DB)':     { name: 'Press', implement: 'Dumbbell', singleArm: true, modifier: 'Split-Stance' },
  'KB SPLIT STANCE SINGLE ARM PRESS':       { name: 'Press', implement: 'Kettlebell', singleArm: true, modifier: 'Split-Stance' },
  'DB SPLIT STANCE SINGLE ARM PRESS':       { name: 'Press', implement: 'Dumbbell', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT STANCE SA KB PRESS':               { name: 'Press', implement: 'Kettlebell', singleArm: true, modifier: 'Split-Stance' },
  'SPLIT STANCE SA DB PRESS':               { name: 'Press', implement: 'Dumbbell', singleArm: true, modifier: 'Split-Stance' },

  // ── DB Front Squat ────────────────────────────────────────────────────────
  'DB FRONT SQUAT': { name: 'Front Squat', implement: 'Dumbbell' },
  'DB F.S.':        { name: 'Front Squat', implement: 'Dumbbell' },
  'DB FS':          { name: 'Front Squat', implement: 'Dumbbell' },

  // ── DB Push Press ─────────────────────────────────────────────────────────
  'DB PUSH PRESS': { name: 'Push Press', implement: 'Dumbbell' },
  'DB PP':         { name: 'Push Press', implement: 'Dumbbell' },

  // ── Z-Press ───────────────────────────────────────────────────────────────
  'Z PRESS':    { name: 'Z-Press' },
  'BB Z-PRESS': { name: 'Z-Press', implement: 'Barbell' },
  'BB Z PRESS': { name: 'Z-Press', implement: 'Barbell' },

  // ── Lu Raise (always DB) ──────────────────────────────────────────────────
  'LU RAISE':    { name: 'Lu Raise', implement: 'Dumbbell' },
  'LU RAISES':   { name: 'Lu Raise', implement: 'Dumbbell' },
  'DB LU RAISE': { name: 'Lu Raise', implement: 'Dumbbell' },

  // ── Tricep Extension ──────────────────────────────────────────────────────
  'DB SEATED TRICEP EX.':       { name: 'Tricep Extension', implement: 'Dumbbell' },
  'DB SEATED TRKEP EX.':        { name: 'Tricep Extension', implement: 'Dumbbell' },
  'DB TRICEP EX.':              { name: 'Tricep Extension', implement: 'Dumbbell' },
  'DB TRICEP EXTENSION':        { name: 'Tricep Extension', implement: 'Dumbbell' },
  'DB SEATED TRICEP EXTENSION': { name: 'Tricep Extension', implement: 'Dumbbell' },

  // ── Crossbody Hammer Curl ─────────────────────────────────────────────────
  'ALT. CROSSBODY HAMMER CURLS': { name: 'Crossbody Hammer Curl' },
  'ALT CROSSBODY HAMMER CURLS':  { name: 'Crossbody Hammer Curl' },
  'CROSSBODY HAMMER CURLS':      { name: 'Crossbody Hammer Curl' },
  'HAMMER CURLS':                { name: 'Hammer Curl' },

  // ── KB Turkish Get-Up ─────────────────────────────────────────────────────
  'TGU':              { name: 'Turkish Get-Up' },
  'KB TURKISH GET-UP':{ name: 'Turkish Get-Up' },
  'KB TGU':           { name: 'Turkish Get-Up' },

  // ── KB Front Rack Hold ────────────────────────────────────────────────────
  'KB FR RACK HOLD':    { name: 'Front Rack Hold', implement: 'Kettlebell' },
  'KB FRONT RACK HOLD': { name: 'Front Rack Hold', implement: 'Kettlebell' },

  // ── Overhead Hold ─────────────────────────────────────────────────────────
  'OH HOLD':         { name: 'Overhead Hold' },
  'OVERHEAD HOLD':   { name: 'Overhead Hold' },
  'OH KB HOLD':      { name: 'Overhead Hold', implement: 'Kettlebell' },
  'KB OVERHEAD HOLD':{ name: 'Overhead Hold', implement: 'Kettlebell' },

  // ── Wall Squat Hold ───────────────────────────────────────────────────────
  'WALL SQ HOLD': { name: 'Wall Squat Hold' },

  // ── Goblet Squat ──────────────────────────────────────────────────────────
  'GOBLET SQ': { name: 'Goblet Squat' },

  // ── Air Squat ─────────────────────────────────────────────────────────────
  'AIR SQ':     { name: 'Air Squat' },
  'AIR SQS':    { name: 'Air Squat' },
  'AIR SQUATS': { name: 'Air Squat' },

  // ── Push-Up / Pull-Up / Chin-Up base forms (modifier variants are handled
  // generically at the top of normalizeMovement() — see PLAIN_PUSH_PULL_RE — since the
  // user never does weighted/deficit/elevated/strict/etc. variations of these) ────────
  'PUSH-UPS':         { name: 'Push-Up' },
  'PUSH UPS':         { name: 'Push-Up' },
  'PULL-UPS':         { name: 'Pull-Up' },
  'PULL UPS':         { name: 'Pull-Up' },
  'CHIN-UPS':         { name: 'Chin-Up' },
  'CHIN UPS':         { name: 'Chin-Up' },
  'CHIN UP':          { name: 'Chin-Up' },

  // ── HSPU / MU abbreviations ───────────────────────────────────────────────
  'HSPU': { name: 'Push Press' },     // always sub push press
  'BMU':  { name: 'Bar Muscle-Up' },
  'MU':   { name: 'Ring Muscle-Up' },
  'RMU':  { name: 'Ring Muscle-Up' },

  // ── Toes to Bar ───────────────────────────────────────────────────────────
  'T2B':         { name: 'Toes to Bar' },
  'TTB':         { name: 'Toes to Bar' },
  'TOES-TO-BAR': { name: 'Toes to Bar' },

  // ── Knee Raise ────────────────────────────────────────────────────────────
  'HANGING KNEE RAISES': { name: 'Hanging Knee Raise' },
  'STRICT KNEE RAISE':   { name: 'Hanging Knee Raise', modifier: 'Strict' },
  'STRICT KNEE RAISES':  { name: 'Hanging Knee Raise', modifier: 'Strict' },

  // ── C2B ───────────────────────────────────────────────────────────────────
  'C2B': { name: 'Chest-to-Bar Pull-Up' },
  'CTB': { name: 'Chest-to-Bar Pull-Up' },

  // ── Double Under ──────────────────────────────────────────────────────────
  'DU':             { name: 'Double Under' },
  'DUS':            { name: 'Double Under' },
  "DU'S":           { name: 'Double Under' },
  'DOUBLE UNDER':   { name: 'Double Under' },
  "DOUBLE UNDER'S": { name: 'Double Under' },
  'DOUBLE UNDERS':  { name: 'Double Under' },

  // ── Hang Clean & Jerk ─────────────────────────────────────────────────────
  'HANG C&J':              { name: 'Hang Clean & Jerk' },
  'SA DB HANG CLEAN & JERK': { name: 'Hang Clean & Jerk', implement: 'Dumbbell', singleArm: true },
  'SA DB HANG C&J':        { name: 'Hang Clean & Jerk', implement: 'Dumbbell', singleArm: true },
  'SA KB HANG CLEAN & JERK': { name: 'Hang Clean & Jerk', implement: 'Kettlebell', singleArm: true },
  'SA KB HANG C&J':        { name: 'Hang Clean & Jerk', implement: 'Kettlebell', singleArm: true },

  // ── Weightlifting abbreviations ───────────────────────────────────────────
  'DL':             { name: 'Deadlift' },
  'P.SN':           { name: 'Power Snatch' },
  'P. SN':          { name: 'Power Snatch' },
  'P.SN.':          { name: 'Power Snatch' },
  'PSN':            { name: 'Power Snatch' },
  'SN':             { name: 'Snatch' },
  'PC':             { name: 'Power Clean' },
  'P. CLEAN':       { name: 'Power Clean' },
  'P.CLEAN':        { name: 'Power Clean' },
  'CL':             { name: 'Clean' },
  'HPC':            { name: 'Hang Power Clean' },
  'HANG PWR SN':    { name: 'Hang Power Snatch' },
  'HANG PSN':       { name: 'Hang Power Snatch' },
  'HANG PWR CLEAN': { name: 'Hang Power Clean' },
  'C&J':            { name: 'Clean & Jerk' },
  'G2OH':           { name: 'Ground to Overhead' },
  'MUSCLE SN':      { name: 'Muscle Snatch' },

  // ── Squat abbreviations ───────────────────────────────────────────────────
  'FS': { name: 'Front Squat' },
  'BS': { name: 'Back Squat' },

  // ── Deadlift variants ─────────────────────────────────────────────────────
  'RDL':            { name: 'Romanian Deadlift' },
  'RDL BUILD':      { name: 'Romanian Deadlift' },
  'SN GRIP DL':     { name: 'Snatch Grip Deadlift' },
  'SN. GRIP DL':    { name: 'Snatch Grip Deadlift' },
  'SNATCH GRIP DL': { name: 'Snatch Grip Deadlift' },
  'DEF. RDL':       { name: 'Romanian Deadlift', modifier: 'Deficit' },
  'KB DEF. RDL':    { name: 'Romanian Deadlift', implement: 'Kettlebell', modifier: 'Deficit' },
  'KB DEFICIT RDL': { name: 'Romanian Deadlift', implement: 'Kettlebell', modifier: 'Deficit' },

  // ── SDHP ──────────────────────────────────────────────────────────────────
  'SDHP':                    { name: 'Sumo Deadlift High Pull' },
  'SUMO DEADLIFT HIGH PULL': { name: 'Sumo Deadlift High Pull' },

  // ── Landmine ──────────────────────────────────────────────────────────────
  'KNEELING LM ROTATIONS':       { name: 'Landmine Rotation', modifier: 'Kneeling' },
  'KNEELING LANDMINE ROTATIONS': { name: 'Landmine Rotation', modifier: 'Kneeling' },
  'LANDMINE ROTATIONS':          { name: 'Landmine Rotation' },

  // ── Pallof Press ──────────────────────────────────────────────────────────
  'BANDED PALLOF PRESS': { name: 'Pallof Press', modifier: 'Banded' },

  // ── DB Floor Press ────────────────────────────────────────────────────────
  'DB FLOOR PRESS': { name: 'Floor Press', implement: 'Dumbbell' },

  // ── SA Half-Kneeling KB Press → base move "Press", Strict as modifier, SA structured ──
  'SA HK KB PRESS': { name: 'Press', implement: 'Kettlebell', singleArm: true, modifier: 'Strict' },
  'SA HK SH.P.':    { name: 'Press', implement: 'Kettlebell', singleArm: true, modifier: 'Strict' },

  // ── Med Ball movements ────────────────────────────────────────────────────
  'WALL BALL':       { name: 'Wall Ball' },
  'WALL BALLS':      { name: 'Wall Ball' },
  'SLAM BALL':       { name: 'Slam Ball' },
  'MB OBLIQUE TOSS': { name: 'Oblique Toss', implement: 'Med Ball' },

  // ── Carries ───────────────────────────────────────────────────────────────
  'FARMER CARRIES':   { name: 'Farmer Carry' },
  'SUITCASE CARRY':   { name: 'Farmer Carry' },
  'SUITCASE CARRIES': { name: 'Farmer Carry' },

  // ── Bike variants → Row (never actually rides the bike, substitutes Row 1:1 —
  // whatever unit the board assigns, e.g. "10 cal bike", carries straight over) ────
  'BIKE':         { name: 'Row' },
  'ASSAULT BIKE': { name: 'Row' },
  'AIR BIKE':     { name: 'Row' },
  'ECHO BIKE':    { name: 'Row' },
}

// Generic fallback for raw names NOT covered by an explicit ALIAS_MAP entry — strips a
// leading implement word (abbreviation OR full word) and/or a leading modifier word,
// in any order, so a new whiteboard combination we haven't hand-aliased yet (e.g. "Alt
// DB Step Up", "Barbell Row") still splits into {name, implement, modifier} instead of
// creating a brand-new baked-in movement name. This is the scalable alternative to
// enumerating every modifier×implement×movement combination by hand.
const IMPLEMENT_WORDS = [
  { match: /^(BARBELL|BB)\b\.?\s*/i,               implement: 'Barbell' },
  { match: /^(DUMBBELL|DB)\b\.?\s*/i,               implement: 'Dumbbell' },
  { match: /^(KETTLEBELL|KB)\b\.?\s*/i,             implement: 'Kettlebell' },
  { match: /^(MEDICINE\s*BALL|MED\s*BALL|MB)\b\.?\s*/i, implement: 'Med Ball' },
  { match: /^PLATE\b\.?\s*/i,                       implement: 'Plate' },
]

// Single-arm is structured (singleArm boolean), not a display modifier string.
const SA_WORD_RE = /^(SINGLE[\s-]?ARM|SA)\b\.?\s*/i

// Modifier words recognized generically wherever they lead a raw name. Deliberately
// excludes 'Sumo' and 'Single-Leg' — those name genuinely distinct movements (different
// biomechanics), not a variation of a shared base movement. Don't add words like that
// here without checking first; this list is for true "how it's done" descriptors.
const MODIFIER_WORDS = [
  { match: /^ALT(?:ERNATING)?\b\.?\s*/i,   modifier: 'Alt' },
  { match: /^STRICT\b\.?\s*/i,             modifier: 'Strict' },
  { match: /^WEIGHTED\b\.?\s*/i,           modifier: 'Weighted' },
  { match: /^DEFICIT\b\.?\s*/i,            modifier: 'Deficit' },
  { match: /^BANDED\b\.?\s*/i,             modifier: 'Banded' },
  { match: /^SPLIT[\s-]?STANCE\b\.?\s*/i,  modifier: 'Split-Stance' },
  { match: /^PRISONER\b\.?\s*/i,           modifier: 'Prisoner' },
  { match: /^KNEELING\b\.?\s*/i,           modifier: 'Kneeling' },
]

// Session-view abbreviations for long movement names
const SESSION_ABBREV = {
  'Romanian Deadlift':      'RDL',
  'Sumo Deadlift High Pull':'SDHP',
  'Ground to Overhead':     'G2OH',
  'Inverted Row':           'Inv Row',
  'Snatch Pull':            'Sn Pull',
}

// Implement → session-view display prefix (Barbell is silent)
const SESSION_PREFIX = {
  Dumbbell:   'DB',
  Kettlebell: 'KB',
  'Med Ball': 'MB',
  Plate:      'Plate',
  Band:       'Banded',
  Rower:      'Rower',
}

// Implement → library-view abbreviation
const LIBRARY_ABBREV = {
  Barbell:    'BB',
  Dumbbell:   'DB',
  Kettlebell: 'KB',
  'Med Ball': 'MB',
  Bodyweight: 'BW',
  Band:       'Band',
  Plate:      'Plate',
  Rower:      'Rower',
}

// Push-Up/Pull-Up/Chin-Up: the user never does modified variations (weighted, deficit,
// plate-elevated, strict, banded, DB/ring, etc.) — any such modifier on the whiteboard
// is intentionally discarded, always logged as the plain bodyweight movement. Checked
// before the alias/implement lookups below so it overrides them uniformly, including
// implement-prefixed forms like "DB Deficit Push-Up". Excludes Chest-to-Bar Pull-Up, a
// genuinely distinct movement that happens to end the same way.
const PLAIN_PUSH_PULL_RE = /^(.+\s)?(push[\s-]?ups?|pull[\s-]?ups?|chin[\s-]?ups?)$/i

// Returns {name, implement?, modifier?, singleArm?} for a raw movement name string.
// Falls back to generically stripping known implement/modifier words, then returns the
// name as-is. Must be idempotent — safe to call again on its own already-canonical
// output (e.g. toWorkoutDisplay re-normalizes move.name on every render), so a name with
// no leading implement/modifier word simply passes through unchanged.
export function normalizeMovement(rawName) {
  if (!rawName) return { name: '' }
  const trimmed = rawName.trim()
  const upper = trimmed.toUpperCase()

  if (!/chest.?to.?bar/i.test(trimmed)) {
    const plainMatch = trimmed.match(PLAIN_PUSH_PULL_RE)
    if (plainMatch) {
      const core = plainMatch[2].toLowerCase()
      if (core.startsWith('push')) return { name: 'Push-Up' }
      if (core.startsWith('pull')) return { name: 'Pull-Up' }
      return { name: 'Chin-Up' }
    }
  }

  const alias = ALIAS_MAP[upper]
  if (alias) return { ...alias }

  // Repeatedly strip a leading implement word and/or modifier word (in any order —
  // "Alt DB Step Up" and "DB Alt Step Up" both resolve the same way) until nothing more
  // matches. Bounded: each iteration must consume text via replace() to continue.
  let rest = trimmed
  let implement = null
  let modifier = null
  let singleArm = false
  let strippedAny = true
  while (strippedAny) {
    strippedAny = false
    if (SA_WORD_RE.test(rest)) {
      rest = rest.replace(SA_WORD_RE, '')
      singleArm = true
      strippedAny = true
    }
    for (const { match, implement: imp } of IMPLEMENT_WORDS) {
      if (match.test(rest)) {
        rest = rest.replace(match, '')
        if (!implement) implement = imp
        strippedAny = true
        break
      }
    }
    for (const { match, modifier: mod } of MODIFIER_WORDS) {
      if (match.test(rest)) {
        rest = rest.replace(match, '')
        if (!modifier) modifier = mod
        strippedAny = true
        break
      }
    }
  }

  if (implement || modifier || singleArm) {
    const result = { name: rest.trim() || trimmed }
    if (implement) result.implement = implement
    if (modifier) result.modifier = modifier
    if (singleArm) result.singleArm = true
    return result
  }

  return { name: trimmed }
}

// Movements where the implement is really "what's being cleared" (a bar, a rower, a
// plate…) rather than something lifted — displayed as a trailing suffix instead of a
// leading prefix, and BB isn't silent like it is for a lifted implement (e.g. "Box Jump
// Over BB" needs the BB spelled out, unlike "BB" being the assumed default for a squat).
const APPENDS_IMPLEMENT_RE = /jump.?over|burpee over/i
export function appendsImplementSuffix(name) {
  return APPENDS_IMPLEMENT_RE.test(name ?? '')
}

// Session-detail display: "SA DB Overhead Lunge (R)", "DB RDL", "Deficit Deadlift"
// Explicit move.implement (short code: 'BB'|'KB'|'DB'|'Plate') takes precedence over normalized.
// Explicit move.singleArm / move.side take precedence over 'SA' modifier from alias map (old data).
// R/L suffixes in the raw name (e.g. " R", " (L)") are preserved even when the alias map would strip them.
export function toWorkoutDisplay(move, { abbreviate = true } = {}) {
  if (!move?.name) return '—'

  // Strip R/L suffix before alias lookup so e.g. "SA OH Lunge R" normalizes via "SA OH Lunge"
  let rawName = move.name
  let rawSide = null
  if (!move.side) {
    const m = rawName.match(/\s*\((R|L|Right|Left)\)\s*$|\s+(R|L|Right|Left)\s*$/i)
    if (m) {
      const s = m[1]
      rawSide = /^right$/i.test(s) ? 'R' : /^left$/i.test(s) ? 'L' : s.toUpperCase()
      rawName = rawName.slice(0, rawName.length - m[0].length).trim()
    }
  }

  const normalized = normalizeMovement(rawName)
  const { name, modifier } = normalized

  let display = abbreviate ? (SESSION_ABBREV[name] ?? name) : name

  const isJumpOver = appendsImplementSuffix(name)

  // Implement — jump/burpee-over movements append the object; all others prepend (BB silent for non-jump-over)
  if (move.implement) {
    if (isJumpOver) {
      const suffix = { BB: 'BB', KB: 'KB', DB: 'DB', Plate: 'Plate', Rower: 'Rower' }[move.implement]
      if (suffix) display = `${display} ${suffix}`
    } else {
      const bareLabel = { KB: 'KB', DB: 'DB', Plate: 'Plate', Rower: 'Rower' }[move.implement] // BB is silent
      // Skip if the abbreviation is already a standalone word in the canonical name (e.g. "Russian KB Swing")
      if (bareLabel && !new RegExp(`\\b${bareLabel}\\b`).test(name)) {
        // A count only applies to DB (e.g. "1 DB Step Up" vs "2 DB Thruster") — disambiguates
        // whether one or both hands are loaded, since that isn't implied by "DB" alone.
        const prefix = move.implement === 'DB' && move.dumbbellCount ? `${move.dumbbellCount} DB` : bareLabel
        display = `${prefix} ${display}`
      }
    }
  } else if (normalized.implement) {
    const prefix = SESSION_PREFIX[normalized.implement]
    if (prefix) {
      display = isJumpOver ? `${display} ${prefix}` : `${prefix} ${display}`
    }
  }

  // Single-arm — explicit persisted field takes precedence; falls back to re-deriving
  // from the raw name (normalized.singleArm, or the legacy 'SA' modifier) only for old
  // data saved before this field existed.
  const isSA = move.singleArm != null ? move.singleArm : (normalized.singleArm || modifier === 'SA')
  if (isSA) display = `SA ${display}`
  if (move.side) display = `${display} (${move.side})`
  else if (rawSide) display = `${display} (${rawSide})`

  // Modifiers (Deficit, Strict, Alt…) — explicit persisted field takes precedence
  // (current data); falls back to re-deriving from the raw name for old data whose
  // name/notes still bake it in.
  const displayModifier = move.modifier ?? (modifier && modifier !== 'SA' ? modifier : null)
  if (displayModifier) display = `${displayModifier} ${display}`

  return display
}

// Movements-tab (library) display: "Step-Up (DB)", "Power Snatch (BB)", "KB Swing"
// Call with the canonical name + explicit implement (when known from the movements table).
// When implement is null/undefined, just returns the canonical name.
export function toLibraryDisplay(name, implement) {
  if (!implement) return name
  const abbrev = LIBRARY_ABBREV[implement] ?? implement
  return `${name} (${abbrev})`
}

// Determines whether a strength block's movements should be displayed/logged as a
// synced multi-movement superset table (one round per row, one column per movement)
// or as independent stacked movements. Explicit block.mode wins; legacy data (no
// mode field) falls back to inferring from equal WORKING-set counts across movements.
// Warmups are allowed to differ per movement (e.g. only one movement warms up) —
// they're rendered/logged independently per movement, not as synced rounds.
export function resolveStrengthMode(block) {
  if (block?.mode === 'multi') return 'multi'
  if (block?.mode === 'single') return 'single'
  const moves = block?.movements ?? []
  if (moves.length < 2) return 'single'
  const workingCounts = moves.map(m => (m.sets ?? []).filter(s => s.notation !== 'warmup').length)
  return (workingCounts.every(c => c === workingCounts[0]) && workingCounts[0] > 0) ? 'multi' : 'single'
}

// Abbreviates a canonical movement name for a narrow table column header, e.g.
// "Power Snatch" -> "P Snatch", "Split-Stance Press" -> "SS Press".
// Reuses SESSION_ABBREV first (RDL, SDHP, G2OH); otherwise keeps the last word whole
// and reduces every earlier word to its initial(s) (hyphenated words contribute one
// letter per part, so "Split-Stance" -> "SS").
export function abbreviateForColumn(canonicalName) {
  if (!canonicalName) return ''
  if (SESSION_ABBREV[canonicalName]) return SESSION_ABBREV[canonicalName]
  const words = canonicalName.split(' ')
  const last = words[words.length - 1]
  const initials = words.slice(0, -1)
    .map(w => w.split('-').map(part => part[0]?.toUpperCase() ?? '').join(''))
    .join(' ')
  return initials ? `${initials} ${last}` : last
}

// Counts distinct OTM minute-slots occupied by a list of movements, used to derive an
// OTM segment's per-round duration (rounds × interval × slots). A movement normally
// occupies just its own `minuteAssignment`, but one with `minuteSpan > 1` (e.g. "Min 1 & 2:
// 350/300m Row" — one effort, a 2-minute cap to finish it, not two separate efforts)
// occupies every minute from `minuteAssignment` through `minuteAssignment + minuteSpan - 1`.
// Works on both DB shape (numbers, field `movements`) and LogScreen form-state shape
// (numeric strings, field `moves`) — callers just pass the array directly.
export function occupiedMinuteSlotCount(moves) {
  const slots = new Set()
  for (const m of moves ?? []) {
    if (m.isRest) continue
    if (m.minuteAssignment == null || m.minuteAssignment === '') continue
    const start = Number(m.minuteAssignment)
    if (!Number.isFinite(start)) continue
    const span = Number(m.minuteSpan) || 1
    for (let i = 0; i < span; i++) slots.add(start + i)
  }
  return slots.size || 1
}

let _measureCanvas = null
export function measureTextWidth(text, font) {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas')
  const ctx = _measureCanvas.getContext('2d')
  ctx.font = font
  return ctx.measureText(text).width
}

// Builds a title from 2+ movements, e.g. "RDL + Inv Row + SS Press" or
// "Romanian Deadlift + Inverted Row + SA DB Split-Stance Press" — never a mix of the
// two: tries full names for every movement first, and only if that string would wrap
// past one line (measured against the caller's actual font + available width) does it
// fall back to abbreviating every movement. Single-movement titles are left to the
// caller (toWorkoutDisplay directly) since there's no mixing concern with one name.
export function buildMultiMoveTitle(movements, { font, maxWidth }) {
  const valid = (movements ?? []).filter(m => m?.name?.trim())
  if (valid.length === 0) return ''
  if (valid.length === 1) return toWorkoutDisplay(valid[0])
  const full = valid.map(m => toWorkoutDisplay(m, { abbreviate: false })).join(' + ')
  if (measureTextWidth(full, font) <= maxWidth) return full
  return valid.map(m => abbreviateForColumn(normalizeMovement(m.name ?? '').name)).join(' + ')
}
