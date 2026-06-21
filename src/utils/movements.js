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

  // ── SA Overhead Lunge (SA is important to show in session view) ───────────
  'SA OH LUNGE':       { name: 'Overhead Lunge', implement: 'Dumbbell', modifier: 'SA' },
  'SA OVERHEAD LUNGE': { name: 'Overhead Lunge', implement: 'Dumbbell', modifier: 'SA' },
  'OH LUNGE':          { name: 'Overhead Lunge' },

  // ── DB Snatch (fused — canonical name includes DB) ────────────────────────
  'DB SNATCH':     { name: 'DB Snatch' },
  'SA DB SNATCH':  { name: 'DB Snatch' },
  'ALT DB SNATCH': { name: 'DB Snatch' },
  'DB SN':         { name: 'DB Snatch' },
  'ALT DB SN':     { name: 'DB Snatch' },

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

  // ── KB Swing / Russian Swing ──────────────────────────────────────────────
  'KB SWING':       { name: 'KB Swing' },
  'BANDED SWING':   { name: 'KB Swing', modifier: 'Banded' },
  'BANDED SWINGS':  { name: 'KB Swing', modifier: 'Banded' },
  'RUSSIAN SWING':  { name: 'Russian Swing' },
  'RUSSIAN SWINGS': { name: 'Russian Swing' },
  'RUSSIAN KB SWING': { name: 'Russian Swing' },

  // ── Gorilla Row / Devil Press (always DB but canonical name has no prefix) ─
  'GORILLA ROW':      { name: 'Gorilla Row' },
  'ALT GORILLA ROW':  { name: 'Gorilla Row' },
  'DB GORILLA ROW':   { name: 'Gorilla Row' },
  'DEVIL PRESS':      { name: 'Devil Press' },
  'DB DEVIL PRESS':   { name: 'Devil Press' },
  "SA DEVIL'S PRESS": { name: 'Devil Press', modifier: 'SA' },

  // ── Prisoner Step-Up ──────────────────────────────────────────────────────
  'PRISONER STEP-UP': { name: 'Step-Up', modifier: 'Prisoner' },
  'PRISONER STEP UP': { name: 'Step-Up', modifier: 'Prisoner' },

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

  // ── KB Front Rack Hold ────────────────────────────────────────────────────
  'KB FR RACK HOLD':    { name: 'Front Rack Hold', implement: 'Kettlebell' },
  'KB FRONT RACK HOLD': { name: 'Front Rack Hold', implement: 'Kettlebell' },

  // ── OH Hold ───────────────────────────────────────────────────────────────
  'OH KB HOLD': { name: 'OH Hold', implement: 'Kettlebell' },

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
  'DB DEF. PUSH-UP':        { name: 'Deficit Push-Up', implement: 'Dumbbell' },
  'DB DEFICIT PUSH-UP':     { name: 'Deficit Push-Up', implement: 'Dumbbell' },
  'DB DEFICIT PUSH-UPS':    { name: 'Deficit Push-Up', implement: 'Dumbbell' },

  // ── Pull-Up / Chin-Up variants ────────────────────────────────────────────
  'PULL-UPS':        { name: 'Pull-Up' },
  'PULL UPS':        { name: 'Pull-Up' },
  'CHIN-UPS':        { name: 'Chin-Up' },
  'CHIN UPS':        { name: 'Chin-Up' },
  'CHIN UP':         { name: 'Chin-Up' },
  'STRICT CHIN-UPS': { name: 'Chin-Up', modifier: 'Strict' },
  'STRICT CHIN-UP':  { name: 'Chin-Up', modifier: 'Strict' },
  'STRICT CHIN UPS': { name: 'Chin-Up', modifier: 'Strict' },
  'STRICT CHIN UP':  { name: 'Chin-Up', modifier: 'Strict' },

  // ── HSPU / MU abbreviations ───────────────────────────────────────────────
  'HSPU': { name: 'Strict Handstand Push-Up' },
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
  '3-POS SN':       { name: '3-Position Snatch' },
  '3 POS SN':       { name: '3-Position Snatch' },

  // ── Squat abbreviations ───────────────────────────────────────────────────
  'FS': { name: 'Front Squat' },
  'BS': { name: 'Back Squat' },

  // ── Deadlift variants ─────────────────────────────────────────────────────
  'RDL':            { name: 'Romanian Deadlift' },
  'DEF. DL':        { name: 'Deficit Deadlift' },
  'DEF. DEADLIFT':  { name: 'Deficit Deadlift' },
  'SN GRIP DL':     { name: 'Snatch Grip Deadlift' },
  'SN. GRIP DL':    { name: 'Snatch Grip Deadlift' },
  'SNATCH GRIP DL': { name: 'Snatch Grip Deadlift' },
  'DEF. RDL':       { name: 'Romanian Deadlift', modifier: 'Deficit' },
  'KB DEF. RDL':    { name: 'Romanian Deadlift', implement: 'Kettlebell', modifier: 'Deficit' },
  'KB DEFICIT RDL': { name: 'Romanian Deadlift', implement: 'Kettlebell', modifier: 'Deficit' },

  // ── SDHP ──────────────────────────────────────────────────────────────────
  'SDHP': { name: 'SDHP' },

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
  'SUITCASE CARRIES': { name: 'Suitcase Carry' },
}

// Implement prefix patterns — tried in order after ALIAS_MAP miss
// Longer/more specific prefixes first
const IMPLEMENT_PREFIXES = [
  { match: /^BB /i,  implement: 'Barbell' },
  { match: /^DB /i,  implement: 'Dumbbell' },
  { match: /^KB /i,  implement: 'Kettlebell' },
  { match: /^MB /i,  implement: 'Med Ball' },
]

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

// Session-detail (whiteboard) display: "DB Sit-Up", "Power Snatch", "KB Swing", "SA DB Overhead Lunge"
// Checks move.implement first (explicit, from new log format) then falls back to name normalization.
export function toWorkoutDisplay(move) {
  if (!move?.name) return '—'
  const normalized = normalizeMovement(move.name)
  const implement = move.implement ?? normalized.implement
  const { name, modifier } = normalized
  let display = name
  if (implement && SESSION_PREFIX[implement]) {
    display = `${SESSION_PREFIX[implement]} ${display}`
  }
  if (modifier) display = `${modifier} ${display}`
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
