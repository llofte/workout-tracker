import Dexie from 'dexie'

export const db = new Dexie('WorkoutTracker')

db.version(1).stores({
  sessions: '++id, date, createdAt',
  movements: '++id, &name',
})

db.version(2).stores({
  sessions: '++id, date, createdAt',
  movements: '++id, &name',
}).upgrade(async tx => {
  const june3 = await tx.table('sessions').where('date').equals('2026-06-03').first()
  if (june3?.metconBlock && !june3.metconBlock.segments) {
    await tx.table('sessions').update(june3.id, {
      metconBlock: {
        format: 'OTM',
        duration: null,
        rounds: null,
        score: null,
        buyIn: null,
        buyOut: null,
        segments: [
          {
            restBefore: null,
            duration: null,
            rounds: 5,
            interval: 1,
            work: null,
            rest: null,
            movements: [
              { name: 'DB Step-Up', reps: 12, weight: 35, weightUnit: 'lbs', minuteAssignment: 1, notes: 'Alt, 50/35' },
              { name: 'SA DB Snatch', reps: 6, weight: 35, weightUnit: 'lbs', minuteAssignment: 2, notes: 'L/R, no alt' },
            ],
          },
          {
            restBefore: 120,
            duration: null,
            rounds: 5,
            interval: 1,
            work: null,
            rest: null,
            movements: [
              { name: 'KB Swing', reps: 12, weight: null, weightUnit: 'lbs', minuteAssignment: 1, notes: 'HAP' },
              { name: 'DB Plank Reach Through', reps: 20, weight: null, weightUnit: 'lbs', minuteAssignment: 2, notes: 'Alt' },
            ],
          },
        ],
      },
    })
  }
})

db.version(3).stores({
  sessions: '++id, date, createdAt',
  movements: '++id, &name',
}).upgrade(async tx => {
  const june2 = await tx.table('sessions').where('date').equals('2026-06-02').first()
  if (june2?.strengthBlock) {
    await tx.table('sessions').update(june2.id, { strengthBlock: null })
  }
})

function makeTestSessions() {
  const dates = []
  const cur = new Date('2025-10-01T12:00:00')
  while (cur < new Date('2026-06-01T12:00:00') && dates.length < 105) {
    if ([1, 3, 5].includes(cur.getDay())) dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  const w = (i, base, range) => Math.round((base + range * i / 99) / 5) * 5
  const sc = (i, mins, base) => `${base + Math.floor(i / 15)}:${String((i * 7 + 10) % 59).padStart(2, '0')}`
  const amrap = (i, base) => `${base + Math.floor(i / 15)} rounds + ${(i * 3 + 2) % 9} reps`
  const seg = (mvs, opts = {}) => ({ restBefore: null, interval: null, work: null, rest: null, ...opts, movements: mvs })
  const mv = (name, reps, weight = null, ma = null, notes = null) => ({ name, reps, weight, weightUnit: 'lbs', minuteAssignment: ma, notes })
  const set = (n, reps, weight, notation = null) => ({ setNumber: n, reps, weight, weightUnit: 'lbs', isFailure: false, isPR: false, notation })
  const sb = (title, mvs) => ({ title, structure: 'Traditional', notes: '', movements: mvs })
  const smv = (name, sets) => ({ name, notes: '', sets })

  const T = [
    // 0: Back Squat 3x5 + 12 min AMRAP
    i => ({
      strengthBlock: sb('Back Squat', [smv('Back Squat', [
        set(1, 5, w(i, 65, 20), 'warmup'), set(1, 5, w(i, 85, 25)), set(2, 5, w(i, 90, 25)), set(3, 5, w(i, 95, 22)),
      ])]),
      metconBlock: { format: 'AMRAP', duration: 12, rounds: null, score: amrap(i, 8), buyIn: null, buyOut: null,
        segments: [seg([mv('Wall Ball', 15, 14), mv('Box Jump', 12), mv('Pull-Up', 9)], { duration: 12 })] },
    }),
    // 1: Deadlift 3x3 + For Time
    i => ({
      strengthBlock: sb('Deadlift', [smv('Deadlift', [
        set(1, 5, w(i, 85, 30), 'warmup'), set(1, 3, w(i, 110, 40)), set(2, 3, w(i, 120, 35)), set(3, 3, w(i, 130, 28)),
      ])]),
      metconBlock: { format: 'For Time', duration: null, rounds: 3, score: sc(i, 3, 11), buyIn: null, buyOut: null,
        segments: [seg([mv('Thruster', 10, w(i, 45, 18)), mv('Row', 15), mv('Burpee', 10)], { rounds: 3 })] },
    }),
    // 2: Front Squat 5x3 + OTM
    i => ({
      strengthBlock: sb('Front Squat', [smv('Front Squat', [
        set(1, 5, w(i, 55, 12), 'warmup'), set(1, 3, w(i, 75, 18)), set(2, 3, w(i, 80, 18)), set(3, 3, w(i, 85, 15)), set(4, 3, w(i, 88, 12)), set(5, 3, w(i, 90, 10)),
      ])]),
      metconBlock: { format: 'OTM', duration: null, rounds: null, score: null, buyIn: null, buyOut: null,
        segments: [seg([mv('KB Swing', 15, w(i, 35, 17), 1, 'HAP'), mv('Box Jump', 10, null, 2, '24"')], { rounds: 10, interval: 1 })] },
    }),
    // 3: Power Snatch build + 10 min AMRAP
    i => ({
      strengthBlock: sb('Power Snatch', [smv('Power Snatch', [
        set(1, 3, w(i, 30, 8), 'warmup'), set(1, 2, w(i, 42, 12)), set(2, 2, w(i, 45, 12)), set(3, 1, w(i, 50, 10)),
      ])]),
      metconBlock: { format: 'AMRAP', duration: 10, rounds: null, score: amrap(i, 6), buyIn: null, buyOut: null,
        segments: [seg([mv('Double Under', 30), mv('Toes to Bar', 10), mv('Power Snatch', 5, w(i, 42, 10))], { duration: 10 })] },
    }),
    // 4: Push Press 4x6 + For Time
    i => ({
      strengthBlock: sb('Push Press', [smv('Push Press', [
        set(1, 5, w(i, 40, 12), 'warmup'), set(1, 6, w(i, 55, 18)), set(2, 6, w(i, 60, 15)), set(3, 6, w(i, 65, 12)), set(4, 6, w(i, 65, 12)),
      ])]),
      metconBlock: { format: 'For Time', duration: null, rounds: 5, score: sc(i, 5, 8), buyIn: null, buyOut: null,
        segments: [seg([mv('Burpee', 8), mv('Wall Ball', 12, 14), mv('Double Under', 25)], { rounds: 5 })] },
    }),
    // 5: Hang Power Clean + OTM
    i => ({
      strengthBlock: sb('Hang Power Clean', [smv('Hang Power Clean', [
        set(1, 3, w(i, 45, 12), 'warmup'), set(1, 3, w(i, 55, 18)), set(2, 3, w(i, 60, 15)), set(3, 3, w(i, 65, 12)),
      ])]),
      metconBlock: { format: 'OTM', duration: null, rounds: null, score: null, buyIn: null, buyOut: null,
        segments: [seg([mv('Hang Power Clean', 4, w(i, 55, 15), 1), mv('Box Jump', 6, null, 2, '24"')], { rounds: 12, interval: 2 })] },
    }),
    // 6: Metcon only — 20 min AMRAP
    i => ({
      strengthBlock: null,
      metconBlock: { format: 'AMRAP', duration: 20, rounds: null, score: amrap(i, 9), buyIn: null, buyOut: null,
        segments: [seg([mv('Row', 15), mv('Box Jump', 12), mv('Pull-Up', 9), mv('Wall Ball', 15, 14)], { duration: 20 })] },
    }),
    // 7: Back Squat 5x3 heavy + For Time
    i => ({
      strengthBlock: sb('Back Squat', [smv('Back Squat', [
        set(1, 3, w(i, 70, 22), 'warmup'), set(1, 3, w(i, 90, 25)), set(2, 3, w(i, 98, 22)), set(3, 3, w(i, 102, 18)), set(4, 3, w(i, 105, 15)), set(5, 3, w(i, 108, 12)),
      ])]),
      metconBlock: { format: 'For Time', duration: null, rounds: 3, score: sc(i, 3, 12), buyIn: null, buyOut: null,
        segments: [seg([mv('Run', '400m'), mv('Deadlift', 10, w(i, 105, 38)), mv('Pull-Up', 10)], { rounds: 3 })] },
    }),
  ]

  return dates.slice(0, 100).map((date, i) => {
    const tmpl = T[i % T.length](i)
    return {
      date, program: 'BB WOD', title: null, notes: 'test',
      whiteboardPhotoUrl: null,
      createdAt: new Date(date + 'T10:00:00').getTime(),
      strengthBlock: tmpl.strengthBlock,
      metconBlock: tmpl.metconBlock,
      accessoryBlock: null,
    }
  })
}

const TEST_MOVEMENTS = [
  { name: 'Wall Ball', aliases: [], category: 'other', prs: [] },
  { name: 'Box Jump', aliases: [], category: 'other', prs: [] },
  { name: 'Pull-Up', aliases: [], category: 'gymnastics', prs: [] },
  { name: 'Double Under', aliases: ['DU'], category: 'other', prs: [] },
  { name: 'Toes to Bar', aliases: ['T2B'], category: 'gymnastics', prs: [] },
  { name: 'Thruster', aliases: [], category: 'weightlifting', prs: [] },
  { name: 'Burpee', aliases: [], category: 'other', prs: [] },
  { name: 'Row', aliases: [], category: 'cardio', prs: [] },
  { name: 'Run', aliases: [], category: 'cardio', prs: [] },
]

db.version(4).stores({
  sessions: '++id, date, createdAt',
  movements: '++id, &name',
}).upgrade(async tx => {
  const testCount = await tx.table('sessions').filter(s => s.notes === 'test').count()
  if (testCount > 0) return
  await tx.table('sessions').bulkAdd(makeTestSessions())
  for (const m of TEST_MOVEMENTS) {
    const exists = await tx.table('movements').where('name').equals(m.name).count()
    if (!exists) await tx.table('movements').add(m)
  }
})

export const MOVEMENTS_BASELINE = [
  // ── Strength ──────────────────────────────────────────────────────────────
  { name: 'Air Squat',                   aliases: [],           category: 'strength', prs: [] },
  { name: 'Back Squat',                  aliases: ['BS'],       category: 'strength', prs: [{ date: '2026-06-05', reps: 1, weight: 120, weightUnit: 'lbs', sessionId: null }] },
  { name: 'Bench Press',                 aliases: [],           category: 'strength', prs: [] },
  { name: 'Bent Over Row',               aliases: [],           category: 'strength', prs: [] },
  { name: 'Bulgarian Split Squat',       aliases: ['BSS'],      category: 'strength', prs: [] },
  { name: 'Deadlift',                    aliases: ['DL'],       category: 'strength', prs: [] },
  { name: 'Farmer Carry',                aliases: [],           category: 'strength', prs: [] },
  { name: 'Floor Press',                 aliases: [],           category: 'strength', prs: [] },
  { name: 'Front Rack Carry',            aliases: [],           category: 'strength', prs: [] },
  { name: 'Front Squat',                 aliases: ['FS'],       category: 'strength', prs: [{ date: '2026-06-08', reps: 3, weight: 100, weightUnit: 'lbs', sessionId: null }] },
  { name: 'Goblet Squat',                aliases: [],           category: 'strength', prs: [] },
  { name: 'Good Morning',                aliases: [],           category: 'strength', prs: [] },
  { name: 'Gorilla Row',                 aliases: [],           category: 'strength', prs: [] },
  { name: 'Hip Thrust',                  aliases: [],           category: 'strength', prs: [] },
  { name: 'Overhead Lunge',              aliases: [],           category: 'strength', prs: [] },
  { name: 'Overhead Squat',              aliases: ['OHS'],      category: 'strength', prs: [] },
  { name: 'Pistol Squat',                aliases: [],           category: 'strength', prs: [] },
  { name: 'Push Press',                  aliases: ['PP'],       category: 'strength', prs: [] },
  { name: 'Reverse Lunge',               aliases: [],           category: 'strength', prs: [] },
  { name: 'Romanian Deadlift',           aliases: ['RDL'],      category: 'strength', prs: [] },
  { name: 'Single-Leg Deadlift',         aliases: [],           category: 'strength', prs: [] },
  { name: 'Snatch Grip Deadlift',        aliases: [],           category: 'strength', prs: [] },
  { name: 'Split-Stance Single-Arm Press', aliases: [],         category: 'strength', prs: [] },
  { name: 'Step-Up',                     aliases: [],           category: 'strength', prs: [] },
  { name: 'Strict Press',                aliases: [],           category: 'strength', prs: [] },
  { name: 'Sumo Deadlift',               aliases: [],           category: 'strength', prs: [] },
  { name: 'Sumo Deadlift High Pull',     aliases: ['SDHP'],     category: 'strength', prs: [] },
  { name: 'Walking Lunge',               aliases: [],           category: 'strength', prs: [] },
  { name: 'Wall Squat Hold',             aliases: [],           category: 'strength', prs: [] },
  { name: 'Z-Press',                     aliases: [],           category: 'strength', prs: [] },
  // ── Weightlifting ─────────────────────────────────────────────────────────
  { name: 'Clean',                aliases: ['CL'],                 category: 'weightlifting', prs: [] },
  { name: 'Clean & Jerk',         aliases: ['C&J'],                category: 'weightlifting', prs: [] },
  { name: 'Ground to Overhead',   aliases: ['G2OH'],               category: 'weightlifting', prs: [] },
  { name: 'Hang Clean',           aliases: [],                     category: 'weightlifting', prs: [] },
  { name: 'Hang Clean & Jerk',    aliases: ['Hang C&J'],           category: 'weightlifting', prs: [] },
  { name: 'Hang Cluster',         aliases: [],                     category: 'weightlifting', prs: [] },
  { name: 'Hang Power Clean',     aliases: ['HPC'],                category: 'weightlifting', prs: [] },
  { name: 'Hang Power Snatch',    aliases: [],                     category: 'weightlifting', prs: [] },
  { name: 'Hang Snatch',          aliases: [],                     category: 'weightlifting', prs: [] },
  { name: 'Jerk',                 aliases: [],                     category: 'weightlifting', prs: [] },
  { name: 'Muscle Snatch',        aliases: [],                     category: 'weightlifting', prs: [] },
  { name: 'Power Clean',          aliases: ['PC'],                 category: 'weightlifting', prs: [] },
  { name: 'Power Snatch',         aliases: ['P.SN', 'PS', 'PSN'], category: 'weightlifting', prs: [{ date: '2026-06-12', reps: 2, weight: 57, weightUnit: 'lbs', sessionId: null }] },
  { name: 'Snatch',               aliases: ['SN'],                 category: 'weightlifting', prs: [] },
  { name: 'Thruster',             aliases: [],                     category: 'weightlifting', prs: [] },
  // ── Gymnastics ────────────────────────────────────────────────────────────
  { name: 'Bar Muscle-Up',            aliases: ['BMU'],          category: 'gymnastics', prs: [] },
  { name: 'Chest-to-Bar Pull-Up',     aliases: ['C2B', 'CTB'],  category: 'gymnastics', prs: [] },
  { name: 'Chin-Up',                  aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Dip',                      aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Hanging Knee Raise',       aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Hollow Hold',              aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Inverted Row',             aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Plank',                    aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Plank Reach Through',      aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Plank Shoulder Taps',      aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Pull-Up',                  aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Push-Up',                  aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Ring Dip',                 aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Ring Muscle-Up',           aliases: ['MU', 'RMU'],   category: 'gymnastics', prs: [] },
  { name: 'Ring Row',                 aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Side Plank Reach Through', aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Sit-Up',                   aliases: [],               category: 'gymnastics', prs: [] },
  { name: 'Toes to Bar',              aliases: ['T2B', 'TTB'],  category: 'gymnastics', prs: [] },
  { name: 'V-Up',                     aliases: [],               category: 'gymnastics', prs: [] },
  // ── Other (metcon/functional) ─────────────────────────────────────────────
  { name: 'Box Jump',              aliases: [],        category: 'other', prs: [] },
  { name: 'Box Jump Over',         aliases: [],        category: 'other', prs: [] },
  { name: 'Broad Jump',            aliases: [],        category: 'other', prs: [] },
  { name: 'Burpee',                aliases: [],        category: 'other', prs: [] },
  { name: 'Burpee Box Jump-Over',  aliases: ['BBJO'],  category: 'other', prs: [] },
  { name: 'Devil Press',           aliases: [],        category: 'other', prs: [] },
  { name: 'KB Swing',              aliases: [],        category: 'other', prs: [] },
  { name: 'Lateral Burpee Over',   aliases: [],        category: 'other', prs: [] },
  { name: 'Lateral Sprawl Jump Over', aliases: [],      category: 'other', prs: [] },
  { name: 'MB Oblique Toss',       aliases: [],        category: 'other', prs: [] },
  { name: 'Rope Climb',            aliases: [],        category: 'other', prs: [] },
  { name: 'Russian KB Swing',      aliases: [],        category: 'other', prs: [] },
  { name: 'Slam Ball',             aliases: [],        category: 'other', prs: [] },
  { name: 'Turkish Get-Up',        aliases: ['TGU'],   category: 'other', prs: [] },
  { name: 'Wall Ball',             aliases: [],        category: 'other', prs: [] },
  { name: 'Wall Walk',             aliases: [],        category: 'other', prs: [] },
  // ── Accessory ─────────────────────────────────────────────────────────────
  { name: 'Crossbody Hammer Curl', aliases: [], category: 'accessory', prs: [] },
  { name: 'Front Rack Hold',       aliases: [], category: 'accessory', prs: [] },
  { name: 'Hammer Curl',           aliases: [], category: 'accessory', prs: [] },
  { name: 'Landmine Rotation',     aliases: [], category: 'accessory', prs: [] },
  { name: 'Overhead Hold',         aliases: [], category: 'accessory', prs: [] },
  { name: 'Pallof Press',          aliases: [], category: 'accessory', prs: [] },
  { name: 'Tricep Extension',      aliases: [], category: 'accessory', prs: [] },
  // ── Cardio ────────────────────────────────────────────────────────────────
  { name: 'Bike',         aliases: [], category: 'cardio', prs: [] },
  { name: 'Double Under', aliases: ['DU'], category: 'cardio', prs: [] },
  { name: 'Row',          aliases: [], category: 'cardio', prs: [] },
  { name: 'Run',          aliases: [], category: 'cardio', prs: [] },
  { name: 'Single Under', aliases: [], category: 'cardio', prs: [] },
  { name: 'Ski Erg',      aliases: [], category: 'cardio', prs: [] },
]

const SEED_SESSIONS = [
  {
    date: '2026-06-02',
    program: 'BB WOD',
    strengthBlock: null,
    metconBlock: {
      format: 'AMRAP',
      duration: 10,
      rounds: 3.5,
      timeCap: null,
      score: '3.5 rounds',
      movements: [
        { name: 'SA OH Lunge', reps: 12, weight: 20, weightUnit: 'lbs', minuteAssignment: null, notes: '6 ea side' },
        { name: 'V-Up', reps: null, weight: null, weightUnit: 'lbs', minuteAssignment: null, notes: null },
        { name: 'Lateral Sprawl DB Jump', reps: null, weight: null, weightUnit: 'lbs', minuteAssignment: null, notes: null },
      ],
      notes: 'Part I',
    },
    notes: 'Metcon only. HealthKit: 20 min, 38 cal',
    whiteboardPhotoUrl: null,
    createdAt: new Date('2026-06-02T12:00:00').getTime(),
  },
  {
    date: '2026-06-03',
    program: 'BB WOD',
    strengthBlock: null,
    metconBlock: {
      format: 'OTM',
      duration: null,
      rounds: null,
      score: null,
      buyIn: null,
      buyOut: null,
      segments: [
        {
          restBefore: null,
          duration: null,
          rounds: 5,
          interval: 1,
          work: null,
          rest: null,
          movements: [
            { name: 'DB Step-Up', reps: 12, weight: 35, weightUnit: 'lbs', minuteAssignment: 1, notes: 'Alt, 50/35' },
            { name: 'SA DB Snatch', reps: 6, weight: 35, weightUnit: 'lbs', minuteAssignment: 2, notes: 'L/R, no alt' },
          ],
        },
        {
          restBefore: 120,
          duration: null,
          rounds: 5,
          interval: 1,
          work: null,
          rest: null,
          movements: [
            { name: 'KB Swing', reps: 12, weight: null, weightUnit: 'lbs', minuteAssignment: 1, notes: 'HAP' },
            { name: 'DB Plank Reach Through', reps: 20, weight: null, weightUnit: 'lbs', minuteAssignment: 2, notes: 'Alt' },
          ],
        },
      ],
    },
    notes: 'BB WOD + Outdoor Run. HealthKit: 44 min, 125 cal. Run: 3.13 mi, 40:01 (Global Running Day 5K), avg HR 165 bpm, peak 178, elevation 201 ft, 243 cal.',
    whiteboardPhotoUrl: null,
    createdAt: new Date('2026-06-03T12:00:00').getTime(),
  },
  {
    date: '2026-06-05',
    program: 'BB WOD',
    strengthBlock: {
      title: 'Back Squat',
      structure: 'EMOM x10',
      movements: [{
        name: 'Back Squat',
        sets: [
          { setNumber: 1, reps: 1, weight: 85, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 2, reps: 1, weight: 90, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 3, reps: 1, weight: 95, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 4, reps: 1, weight: 100, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 5, reps: 1, weight: 105, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 6, reps: 1, weight: 110, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 7, reps: 1, weight: 115, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 8, reps: 1, weight: 115, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 9, reps: 1, weight: 115, weightUnit: 'lbs', isFailure: false, isPR: false, notation: null },
          { setNumber: 10, reps: 1, weight: 120, weightUnit: 'lbs', isFailure: false, isPR: true, notation: '1RM PR' },
        ],
        notes: '1RM PR at 120 lbs',
      }],
      notes: 'Building to 1RM PR',
    },
    metconBlock: {
      format: 'For Time',
      duration: null,
      rounds: 10,
      timeCap: null,
      score: null,
      movements: [
        { name: 'Power Snatch', reps: 3, weight: 42, weightUnit: 'lbs', minuteAssignment: null, notes: null },
        { name: 'Push Press', reps: 5, weight: 20, weightUnit: 'lbs', minuteAssignment: null, notes: 'DB — HSPU sub' },
        { name: 'Row', reps: 6, weight: null, weightUnit: 'lbs', minuteAssignment: null, notes: 'cal — bike sub' },
      ],
      notes: '10 rounds',
    },
    notes: 'HealthKit: 61 min, 156 cal, avg HR 126 bpm, peak 172',
    whiteboardPhotoUrl: null,
    createdAt: new Date('2026-06-05T12:00:00').getTime(),
  },
  {
    date: '2026-06-08',
    program: 'BB WOD',
    strengthBlock: {
      title: 'Front Squat',
      structure: '3RM build',
      movements: [{
        name: 'Front Squat',
        sets: [
          { setNumber: 1, reps: 3, weight: 65, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 2, reps: 3, weight: 75, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 3, reps: 3, weight: 85, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 4, reps: 3, weight: 90, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 5, reps: 3, weight: 95, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 6, reps: 3, weight: 100, weightUnit: 'lbs', isFailure: false, isPR: true, notation: '3RM PR' },
        ],
        notes: '3RM PR at 100 lbs',
      }],
      notes: '3RM build to PR',
    },
    metconBlock: {
      format: 'For Time',
      duration: null,
      rounds: null,
      timeCap: null,
      score: '17:10',
      movements: [
        { name: 'Row', reps: '27-21-15-9', weight: null, weightUnit: 'lbs', minuteAssignment: null, notes: 'cal' },
        { name: 'KB Swing', reps: '27-21-15-9', weight: 26, weightUnit: 'lbs', minuteAssignment: null, notes: null },
        { name: 'Weighted Sit-Up', reps: '27-21-15-9', weight: 20, weightUnit: 'lbs', minuteAssignment: null, notes: '20# ball' },
      ],
      notes: '27-21-15-9 for time',
    },
    notes: 'HealthKit: 57 min, 123 cal',
    whiteboardPhotoUrl: null,
    createdAt: new Date('2026-06-08T12:00:00').getTime(),
  },
  {
    date: '2026-06-10',
    program: 'BB WOD',
    strengthBlock: null,
    metconBlock: {
      format: 'For Time',
      duration: null,
      rounds: 6,
      timeCap: null,
      score: '22:02',
      movements: [
        { name: 'Run', reps: '200m', weight: null, weightUnit: 'lbs', minuteAssignment: null, notes: null },
        { name: 'Hang Power Clean', reps: 9, weight: 42, weightUnit: 'lbs', minuteAssignment: null, notes: null },
        { name: 'Burpee', reps: 6, weight: null, weightUnit: 'lbs', minuteAssignment: null, notes: null },
        { name: 'Jerk', reps: 3, weight: 42, weightUnit: 'lbs', minuteAssignment: null, notes: null },
      ],
      notes: '6 rounds for time, 1:00 rest between rounds',
    },
    notes: 'HealthKit: 46 min, 161 cal, avg HR 142 bpm, peak 176',
    whiteboardPhotoUrl: null,
    createdAt: new Date('2026-06-10T12:00:00').getTime(),
  },
  {
    date: '2026-06-12',
    program: 'BB WOD',
    strengthBlock: {
      title: 'Power Snatch',
      structure: '12 min OTM x2, build',
      movements: [{
        name: 'Power Snatch',
        sets: [
          { setNumber: 1, reps: 2, weight: 42, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 2, reps: 2, weight: 42, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 3, reps: 2, weight: 47, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 4, reps: 2, weight: 47, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 5, reps: 2, weight: 47, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 6, reps: 2, weight: 52, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 7, reps: 2, weight: 52, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 8, reps: 2, weight: 52, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 9, reps: 2, weight: 52, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 10, reps: 2, weight: 52, weightUnit: 'lbs', isFailure: false, isPR: false, notation: 'build' },
          { setNumber: 11, reps: 2, weight: 57, weightUnit: 'lbs', isFailure: false, isPR: true, notation: '2RM PR' },
        ],
        notes: '2RM PR at 57 lbs',
      }],
      notes: '12 min OTM x2, building to 2RM PR',
    },
    metconBlock: {
      format: 'OTM',
      duration: 12,
      rounds: null,
      timeCap: null,
      score: null,
      movements: [
        { name: 'Burpee Box Jump-Over', reps: 8, weight: null, weightUnit: 'lbs', minuteAssignment: 1, notes: 'Rds 1-2 full, 3-4 half (no push-up), 5-6 no push-up' },
        { name: 'Deadlift', reps: 5, weight: 105, weightUnit: 'lbs', minuteAssignment: 2, notes: null },
      ],
      notes: '12 min OTM',
    },
    notes: 'HealthKit: 48 min, 150 cal, avg HR 142 bpm, peak 176',
    whiteboardPhotoUrl: null,
    createdAt: new Date('2026-06-12T12:00:00').getTime(),
  },
]

export async function seedIfEmpty() {
  const [movementCount, sessionCount] = await Promise.all([
    db.movements.count(),
    db.sessions.count(),
  ])
  if (movementCount === 0) await db.movements.bulkAdd(MOVEMENTS_BASELINE)
  if (sessionCount === 0) await db.sessions.bulkAdd(SEED_SESSIONS)
}
