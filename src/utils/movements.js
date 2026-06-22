// Alias map: uppercase raw name → canonical {name, implement?, modifier?}
// 'implement' is one of: 'Barbell' | 'Dumbbell' | 'Kettlebell' | 'Med Ball' | 'Band' | 'Plate'
// 'modifier' is a display-level prefix: 'SA' | 'Strict' | 'Banded' | 'Prisoner' | etc.
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

  // ── Overhead Lunge ────────────────────────────────────────────────────────
  'SA OH LUNGE':           { name: 'Overhead Lunge', implement: 'Dumbbell', modifier: 'SA' },
  'SA OVERHEAD LUNGE':     { name: 'Overhead Lunge', implement: 'Dumbbell', modifier: 'SA' },
  'OH LUNGE':              { name: 'Overhead Lunge' },
  'OVERHEAD PLATE LUNGE':  { name: 'Overhead Lunge', implement: 'Plate' },
  'OVERHEAD PLATE LUNGES': { name: 'Overhead Lunge', implement: 'Plate' },
  'OH PLATE LUNGE':        { name: 'Overhead Lunge', implement: 'Plate' },
  'PLATE OVERHEAD LUNGE':  { name: 'Overhead Lunge', implement: 'Plate' },

  // ── Front Rack Lunge → Walking Lunge ─────────────────────────────────────
  'FRONT RACK LUNGE':  { name: 'Walking Lunge' },
  'FRONT RACK LUNGES': { name: 'Walking Lunge' },

  // ── DB Snatch → merged into Snatch (implement: Dumbbell) ─────────────────
  'DB SNATCH':     { name: 'Snatch', implement: 'Dumbbell' },
  'SA DB SNATCH':  { name: 'Snatch', implement: 'Dumbbell', modifier: 'SA' },
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

  // ── Lateral Sprawl DB Jump ────────────────────────────────────────────────
  'LATERAL SPRAWL DB JUMP': { name: 'Lateral Sprawl Jump', implement: 'Dumbbell' },

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

  // ── Lateral Burpee Over (specific objects become the canonical variant) ───
  'LATERAL BURPEE OVER BAR':   { name: 'Lateral Burpee Over Bar' },
  'LATERAL BURPEE OVER ROWER': { name: 'Lateral Burpee Over Rower' },
  'LAT. BURPEE OVER BAR':      { name: 'Lateral Burpee Over Bar' },
  'LAT. BURPEE OVER ROWER':    { name: 'Lateral Burpee Over Rower' },

  // ── KB Swing / Russian KB Swing ───────────────────────────────────────────
  'KB SWING':         { name: 'KB Swing' },
  'BANDED SWING':     { name: 'KB Swing', modifier: 'Banded' },
  'BANDED SWINGS':    { name: 'KB Swing', modifier: 'Banded' },
  'RUSSIAN SWING':    { name: 'Russian KB Swing' },
  'RUSSIAN SWINGS':   { name: 'Russian KB Swing' },
  'RUSSIAN KB SWING': { name: 'Russian KB Swing' },
  'RUSSIAN KB SWINGS':{ name: 'Russian KB Swing' },

  // ── Gorilla Row (always KB) / Devil Press ─────────────────────────────────
  'GORILLA ROW':      { name: 'Gorilla Row', implement: 'Kettlebell' },
  'ALT GORILLA ROW':  { name: 'Gorilla Row', implement: 'Kettlebell' },
  'DB GORILLA ROW':   { name: 'Gorilla Row', implement: 'Kettlebell' },
  'KB GORILLA ROW':   { name: 'Gorilla Row', implement: 'Kettlebell' },
  'DEVIL PRESS':      { name: 'Devil Press' },
  'DB DEVIL PRESS':   { name: 'Devil Press' },
  "SA DEVIL'S PRESS": { name: 'Devil Press', modifier: 'SA' },

  // ── Prisoner Step-Up ──────────────────────────────────────────────────────
  'PRISONER STEP-UP': { name: 'Step-Up', modifier: 'Prisoner' },
  'PRISONER STEP UP': { name: 'Step-Up', modifier: 'Prisoner' },

  // ── Split-Stance Single-Arm Press ─────────────────────────────────────────
  'SPLIT STANCE SINGLE ARM PRESS':          { name: 'Split-Stance Single-Arm Press' },
  'SPLIT-STANCE SINGLE-ARM PRESS':          { name: 'Split-Stance Single-Arm Press' },
  'SPLIT STANCE SA PRESS':                  { name: 'Split-Stance Single-Arm Press' },
  'SPLIT STANCE SINGLE ARM PRESS (KB)':     { name: 'Split-Stance Single-Arm Press', implement: 'Kettlebell' },
  'SPLIT-STANCE SINGLE-ARM PRESS (KB)':     { name: 'Split-Stance Single-Arm Press', implement: 'Kettlebell' },
  'SPLIT STANCE SINGLE ARM PRESS (DB)':     { name: 'Split-Stance Single-Arm Press', implement: 'Dumbbell' },
  'SPLIT-STANCE SINGLE-ARM PRESS (DB)':     { name: 'Split-Stance Single-Arm Press', implement: 'Dumbbell' },
  'KB SPLIT STANCE SINGLE ARM PRESS':       { name: 'Split-Stance Single-Arm Press', implement: 'Kettlebell' },
  'DB SPLIT STANCE SINGLE ARM PRESS':       { name: 'Split-Stance Single-Arm Press', implement: 'Dumbbell' },
  'SPLIT STANCE SA KB PRESS':               { name: 'Split-Stance Single-Arm Press', implement: 'Kettlebell' },
  'SPLIT STANCE SA DB PRESS':               { name: 'Split-Stance Single-Arm Press', implement: 'Dumbbell' },

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

  // ── Push-Up variants ──────────────────────────────────────────────────────
  'PUSH-UPS':               { name: 'Push-Up' },
  'PUSH UPS':               { name: 'Push-Up' },
  'PLATE ELEVATED PUSH-UP': { name: 'Push-Up', modifier: 'Plate Elevated' },
  'PLATE ELEVATED P.U.':    { name: 'Push-Up', modifier: 'Plate Elevated' },
  'DEFICIT PUSH-UP':        { name: 'Push-Up', modifier: 'Deficit' },
  'DEFICIT PUSH-UPS':       { name: 'Push-Up', modifier: 'Deficit' },
  'DB DEF. PUSH-UP':        { name: 'Push-Up', implement: 'Dumbbell', modifier: 'Deficit' },
  'DB DEFICIT PUSH-UP':     { name: 'Push-Up', implement: 'Dumbbell', modifier: 'Deficit' },
  'DB DEFICIT PUSH-UPS':    { name: 'Push-Up', implement: 'Dumbbell', modifier: 'Deficit' },

  // ── Pull-Up / Chin-Up variants ────────────────────────────────────────────
  'PULL-UPS':         { name: 'Pull-Up' },
  'PULL UPS':         { name: 'Pull-Up' },
  'STRICT PULL-UP':   { name: 'Pull-Up', modifier: 'Strict' },
  'STRICT PULL-UPS':  { name: 'Pull-Up', modifier: 'Strict' },
  'STRICT PULL UP':   { name: 'Pull-Up', modifier: 'Strict' },
  'STRICT PULL UPS':  { name: 'Pull-Up', modifier: 'Strict' },
  'CHIN-UPS':         { name: 'Chin-Up' },
  'CHIN UPS':         { name: 'Chin-Up' },
  'CHIN UP':          { name: 'Chin-Up' },
  'STRICT CHIN-UPS':  { name: 'Chin-Up', modifier: 'Strict' },
  'STRICT CHIN-UP':   { name: 'Chin-Up', modifier: 'Strict' },
  'STRICT CHIN UPS':  { name: 'Chin-Up', modifier: 'Strict' },
  'STRICT CHIN UP':   { name: 'Chin-Up', modifier: 'Strict' },

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

  // ── SA KB Press ───────────────────────────────────────────────────────────
  'SA HK KB PRESS': { name: 'Strict Press', implement: 'Kettlebell', modifier: 'SA' },
  'SA HK SH.P.':    { name: 'Strict Press', implement: 'Kettlebell', modifier: 'SA' },

  // ── Med Ball movements ────────────────────────────────────────────────────
  'WALL BALL':       { name: 'Wall Ball' },
  'WALL BALLS':      { name: 'Wall Ball' },
  'SLAM BALL':       { name: 'Slam Ball' },
  'MB OBLIQUE TOSS': { name: 'MB Oblique Toss' },

  // ── Carries ───────────────────────────────────────────────────────────────
  'FARMER CARRIES':   { name: 'Farmer Carry' },
  'SUITCASE CARRY':   { name: 'Farmer Carry' },
  'SUITCASE CARRIES': { name: 'Farmer Carry' },
}

// Implement prefix patterns — tried in order after ALIAS_MAP miss
// Longer/more specific prefixes first
const IMPLEMENT_PREFIXES = [
  { match: /^BB /i,  implement: 'Barbell' },
  { match: /^DB /i,  implement: 'Dumbbell' },
  { match: /^KB /i,  implement: 'Kettlebell' },
  { match: /^MB /i,  implement: 'Med Ball' },
]

// Session-view abbreviations for long movement names
const SESSION_ABBREV = {
  'Romanian Deadlift':      'RDL',
  'Sumo Deadlift High Pull':'SDHP',
  'Ground to Overhead':     'G2OH',
}

// Implement → session-view display prefix (Barbell is silent)
const SESSION_PREFIX = {
  Dumbbell:   'DB',
  Kettlebell: 'KB',
  'Med Ball': 'MB',
  Plate:      'Plate',
  Band:       'Banded',
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
}

// Returns {name, implement?, modifier?} for a raw movement name string.
// Falls back to stripping known implement prefixes, then returns the name as-is.
export function normalizeMovement(rawName) {
  if (!rawName) return { name: '' }
  const trimmed = rawName.trim()
  const upper = trimmed.toUpperCase()

  const alias = ALIAS_MAP[upper]
  if (alias) return { ...alias }

  for (const { match, implement } of IMPLEMENT_PREFIXES) {
    if (match.test(trimmed)) {
      return { name: trimmed.replace(match, ''), implement }
    }
  }

  return { name: trimmed }
}

// Session-detail display: "SA KB Overhead Lunge (L)", "DB RDL", "Deficit Deadlift"
// Explicit move.implement (short code: 'BB'|'KB'|'DB'|'Plate') takes precedence over normalized.
// Explicit move.singleArm / move.side take precedence over 'SA' modifier from alias map (old data).
export function toWorkoutDisplay(move) {
  if (!move?.name) return '—'
  const normalized = normalizeMovement(move.name)
  const { name, modifier } = normalized

  let display = SESSION_ABBREV[name] ?? name

  // Implement prefix
  if (move.implement) {
    const prefix = { KB: 'KB', DB: 'DB', Plate: 'Plate' }[move.implement] // BB is silent
    if (prefix) display = `${prefix} ${display}`
  } else if (normalized.implement) {
    const prefix = SESSION_PREFIX[normalized.implement]
    if (prefix) display = `${prefix} ${display}`
  }

  // Single-arm — explicit field (new) or 'SA' modifier from alias (old data)
  const isSA = move.singleArm != null ? move.singleArm : modifier === 'SA'
  if (isSA) display = `SA ${display}`
  if (move.side) display = `${display} (${move.side})`

  // Non-SA modifiers (Deficit, Strict…) prepended
  if (modifier && modifier !== 'SA') display = `${modifier} ${display}`

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
