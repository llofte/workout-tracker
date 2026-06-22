import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, sessionToRow } from '../db/supabase'
import { useMovements } from '../hooks/useMovements'
import { normalizeMovement } from '../utils/movements'

// Full implement name → selector short code
const IMPL_SHORT = { Barbell: 'BB', Dumbbell: 'DB', Kettlebell: 'KB', Plate: 'Plate' }

const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY &&
  import.meta.env.VITE_ANTHROPIC_API_KEY !== 'your_key_here'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  return `${weekday} · ${month} ${day}`
}

function newWorkingSet(num) { return { num, reps: '', weight: '', isWarmup: false } }
function newWarmupSet(num) { return { num: `W${num}`, reps: '', weight: '', isWarmup: true } }
function newStrengthMove() { return { name: '', sets: [newWorkingSet(1)], notes: '', implement: null, singleArm: false, side: null } }
function newMetconMove() { return { name: '', reps: '', weight: '', minuteAssignment: '', isRest: false, restMin: '', restSec: '', notes: '', implement: null, singleArm: false, side: null } }
function newTabataMove() { return { name: '', rounds: '8', reps: '', weight: '', notes: '' } }
function newMetconSegment(withRest) {
  return {
    restBeforeMin: withRest ? '2' : '',
    restBeforeSec: withRest ? '0' : '',
    duration: '',
    rounds: '',
    interval: '1',
    tabataWork: '20',
    tabataRest: '10',
    ladderScheme: '',
    moves: [newMetconMove()],
  }
}

function parseStrengthStructure(structure) {
  if (!structure || structure === 'Traditional') return { type: 'Traditional', duration: '', interval: '1' }
  const m = structure.match(/^(\d+) min OTM every (\d+) min/)
  if (m) return { type: 'OTM', duration: m[1], interval: m[2] }
  return { type: 'Traditional', duration: '', interval: '1' }
}

function restoreStrengthMove(m) {
  let wn = 0, wkn = 0
  let implement = m.implement ?? null
  let singleArm = m.singleArm ?? false
  let side = m.side ?? null
  const norm = m.name ? normalizeMovement(m.name) : null
  const canonName = norm?.name || m.name || ''
  if (implement == null && norm?.implement) implement = IMPL_SHORT[norm.implement] ?? null
  if (!singleArm && norm?.modifier === 'SA') singleArm = true
  if (!side && m.name) {
    if (m.name.trim().endsWith('(L)')) side = 'L'
    else if (m.name.trim().endsWith('(R)')) side = 'R'
  }
  return {
    name: canonName,
    sets: m.sets?.map(s => s.notation === 'warmup'
      ? { num: `W${++wn}`, reps: s.reps?.toString() ?? '', weight: s.weight?.toString() ?? '', isWarmup: true }
      : { num: ++wkn, reps: s.reps?.toString() ?? '', weight: s.weight?.toString() ?? '', isWarmup: false }
    ) ?? [newWorkingSet(1)],
    notes: m.notes || '',
    implement,
    singleArm,
    side,
    dumbbellCount: m.dumbbellCount ?? null,
  }
}

function restoreMetconMove(m) {
  if (m.isRest) {
    const t = m.restSeconds || 0
    return { name: '', reps: '', weight: '', minuteAssignment: '', isRest: true,
      restMin: t >= 60 ? String(Math.floor(t / 60)) : '',
      restSec: t % 60 ? String(t % 60) : '', notes: '',
      implement: null, singleArm: false, side: null }
  }
  let implement = m.implement ?? null
  let singleArm = m.singleArm ?? false
  let side = m.side ?? null
  const norm = m.name ? normalizeMovement(m.name) : null
  const canonName = norm?.name || m.name || ''
  if (implement == null && norm?.implement) implement = IMPL_SHORT[norm.implement] ?? null
  if (!singleArm && norm?.modifier === 'SA') singleArm = true
  if (!side && m.name) {
    if (m.name.trim().endsWith('(L)')) side = 'L'
    else if (m.name.trim().endsWith('(R)')) side = 'R'
  }
  return {
    name: canonName, reps: m.reps?.toString() ?? '',
    weight: m.weight?.toString() ?? '',
    minuteAssignment: m.minuteAssignment?.toString() ?? '',
    isRest: false, restMin: '', restSec: '', notes: m.notes || '',
    implement, singleArm, side,
  }
}

function restoreSegment(seg, format) {
  const rb = seg.restBefore || 0
  const ladderScheme = format === 'Ladder' ? (seg.movements?.[0]?.reps?.toString() ?? '') : ''
  return {
    restBeforeMin: rb ? String(Math.floor(rb / 60)) : '',
    restBeforeSec: rb ? String(rb % 60) : '',
    duration: seg.duration?.toString() ?? '',
    rounds: seg.rounds?.toString() ?? '',
    interval: seg.interval?.toString() ?? '1',
    tabataWork: seg.work?.toString() ?? '20',
    tabataRest: seg.rest?.toString() ?? '10',
    ladderScheme,
    moves: seg.movements?.length ? seg.movements.map(restoreMetconMove) : [newMetconMove()],
  }
}

async function detectPRs(sessionId, date, strengthBlock) {
  if (!strengthBlock?.movements?.length) return null
  let anyPR = false
  const updatedMovements = []

  for (const move of strengthBlock.movements) {
    if (!move.name) { updatedMovements.push(move); continue }
    const { data: record } = await supabase.from('movements').select('*').eq('name', move.name).maybeSingle()
    if (!record) { updatedMovements.push(move); continue }

    const prs = [...(record.prs ?? [])]
    const dbMultiplier = move.dumbbellCount ?? 1
    let movePR = false
    const updatedSets = move.sets.map(set => {
      if (set.notation === 'warmup' || set.weight == null || set.reps == null) return set
      const totalLoad = set.weight * dbMultiplier
      const best = prs
        .filter(p => p.reps === set.reps)
        .reduce((b, p) => p.weight > (b?.weight ?? -1) ? p : b, null)
      if (!best || totalLoad > best.weight) {
        prs.push({ date, reps: set.reps, weight: totalLoad, weightUnit: 'lbs', sessionId })
        movePR = true
        anyPR = true
        return { ...set, isPR: true }
      }
      return set
    })

    if (movePR) await supabase.from('movements').update({ prs }).eq('id', record.id)
    updatedMovements.push({ ...move, sets: updatedSets })
  }

  return anyPR ? { ...strengthBlock, movements: updatedMovements } : null
}

const FORMATS = ['AMRAP', 'For Time', 'Ladder', 'OTM', 'Tabata', 'Other']

function isLadder(val) {
  if (!val || typeof val !== 'string') return false
  const parts = val.trim().replace(/\s+/g, '').split(/[,\-]/)
  return parts.length >= 2 && parts.every(p => /^\d+$/.test(p) && Number(p) > 0)
}
function parseLadder(val) {
  return val.trim().replace(/\s+/g, '').split(/[,\-]/).map(Number)
}

const inputBase = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: 'none', borderRadius: 10, padding: '11px 14px',
  fontSize: 16, color: '#f5f0e8', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box', display: 'block',
}

const labelStyle = {
  color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px', fontFamily: 'inherit',
}

// ─── Library Sheet ────────────────────────────────────────────────────
function LibrarySheet({ onSelect, onClose }) {
  const movements = useMovements()
  const [query, setQuery] = useState('')
  const filtered = (movements ?? []).filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: '#201a2a', borderRadius: '20px 20px 0 0', zIndex: 201,
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#f5f0e8', fontSize: 17, fontWeight: 600, fontFamily: 'inherit' }}>Movement Library</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.55)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
          <input
            type="search" placeholder="Search..." value={query}
            onChange={e => setQuery(e.target.value)} autoFocus
            style={{ ...inputBase, backgroundColor: 'rgba(255,255,255,0.09)' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingTop: 8 }}>
          {filtered.map(m => (
            <button key={m.id} onClick={() => onSelect(m.name)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', backgroundColor: 'transparent', border: 'none',
              borderBottom: '0.5px solid rgba(255,255,255,0.07)', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ color: '#f5f0e8', fontSize: 16, fontFamily: 'inherit' }}>{m.name}</span>
              {m.prs?.length > 0 && (
                <span style={{ backgroundColor: 'rgba(192,57,43,0.2)', color: '#e05c4b', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>PR</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Set Row ──────────────────────────────────────────────────────────
function SetRow({ set, onChange, onDelete }) {
  const dimColor = set.isWarmup ? 'rgba(245,240,232,0.22)' : 'rgba(245,240,232,0.3)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, paddingBottom: 6, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
      <span style={{ width: 28, flexShrink: 0, textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: set.isWarmup ? 'rgba(245,240,232,0.28)' : 'rgba(245,240,232,0.45)' }}>
        {set.isWarmup ? 'W' : set.num}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <input
          type="number" inputMode="numeric" placeholder="—" value={set.reps}
          onChange={e => onChange('reps', e.target.value)}
          style={{ width: '100%', backgroundColor: set.isWarmup ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '8px 8px', fontSize: 16, color: set.isWarmup ? 'rgba(245,240,232,0.5)' : '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
        />
        <span style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: dimColor, fontFamily: 'inherit' }}>reps</span>
      </div>
      <div style={{ flex: 1.6, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <input
          type="number" inputMode="decimal" placeholder="—" value={set.weight}
          onChange={e => onChange('weight', e.target.value)}
          style={{ width: '100%', backgroundColor: set.isWarmup ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '8px 8px', fontSize: 16, color: set.isWarmup ? 'rgba(245,240,232,0.5)' : '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
        />
        <span style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: dimColor, fontFamily: 'inherit' }}>lbs</span>
      </div>
      <button onClick={onDelete} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,0.5)" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ─── Suggest Button ───────────────────────────────────────────────────
function buildSuggestPrompt(movementName, targetDesc, history) {
  const histLine = history.length
    ? history.map(h => `${h.date}: ${h.sets.join(', ')}`).join('\n')
    : 'No previous history logged for this movement.'
  return `You're a strength coach recommending a weight for Leanna's next exercise.

Movement: ${movementName}
Today's plan: ${targetDesc}

Recent history (newest first):
${histLine}

Give a specific weight recommendation and one brief sentence of reasoning. Be direct and concrete. Plain text only — no markdown, no bullet points. Example: "Start at 95 lbs — you hit that for 5×5 last session and it moved well."`
}

function SuggestButton({ name, sets }) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const prevName = useRef(name)

  useEffect(() => {
    if (prevName.current !== name) {
      setSuggestion(null)
      prevName.current = name
    }
  }, [name])

  if (!hasApiKey) return null

  async function suggest() {
    if (!name?.trim() || loading) return
    setLoading(true)
    setSuggestion(null)
    try {
      const trimmed = name.trim().toLowerCase()
      const { data: sessions } = await supabase.from('sessions').select('date, strength_block').order('date', { ascending: false }).limit(20)
      const history = []
      for (const session of (sessions ?? [])) {
        const moves = (session.strength_block ?? session.strengthBlock)?.movements ?? []
        const match = moves.find(m => m.name?.trim().toLowerCase() === trimmed)
        if (match) {
          const working = (match.sets ?? []).filter(s => !s.isWarmup && s.weight && s.reps)
          if (working.length) {
            const dateStr = new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            history.push({ date: dateStr, sets: working.map(s => `${s.reps}×${s.weight} lbs`) })
          }
        }
        if (history.length >= 6) break
      }
      const working = sets.filter(s => !s.isWarmup && s.reps)
      const repCounts = [...new Set(working.map(s => s.reps).filter(Boolean))]
      const targetDesc = repCounts.length
        ? `${working.length} sets of ${repCounts.join('/')} reps`
        : `${working.length || sets.length} working sets`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 120,
          messages: [{ role: 'user', content: buildSuggestPrompt(name.trim(), targetDesc, history) }],
        }),
      })
      const data = await res.json()
      setSuggestion(data.content[0].text.trim())
    } catch {
      setSuggestion("Couldn't get a suggestion — check your connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!suggestion && (
        <button
          onClick={suggest}
          disabled={loading || !name?.trim()}
          style={{
            background: 'none', border: 'none', padding: '0 0 8px 2px',
            cursor: loading || !name?.trim() ? 'default' : 'pointer',
            color: !name?.trim() ? 'rgba(245,240,232,0.2)' : loading ? 'rgba(245,240,232,0.35)' : 'rgba(245,240,232,0.5)',
            fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          {loading ? (
            <>
              <style>{`@keyframes sg-spin { to { transform: rotate(360deg) } }`}</style>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(245,240,232,0.15)', borderTopColor: 'rgba(245,240,232,0.55)', animation: 'sg-spin 0.7s linear infinite', flexShrink: 0 }} />
              Thinking…
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              Suggest weight
            </>
          )}
        </button>
      )}
      {suggestion && (
        <div style={{ backgroundColor: 'rgba(245,240,232,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <p style={{ color: 'rgba(245,240,232,0.78)', fontSize: 13, margin: 0, lineHeight: 1.5, fontFamily: 'inherit', flex: 1 }}>{suggestion}</p>
          <button onClick={() => setSuggestion(null)} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.3)', cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 0, marginTop: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </>
  )
}

// ─── DB Toggle (metcon) ───────────────────────────────────────────────
function DbToggle({ value, onChange }) {
  const pill = (active) => ({
    backgroundColor: active ? 'rgba(15,247,197,0.14)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${active ? 'rgba(15,247,197,0.3)' : 'transparent'}`,
    borderRadius: 8, padding: '5px 11px',
    fontSize: 12, fontWeight: active ? 700 : 500, letterSpacing: 0.2,
    color: active ? '#0ff7c5' : 'rgba(245,240,232,0.45)',
    fontFamily: 'inherit', cursor: 'pointer',
  })
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {[1, 2].map(n => (
        <button key={n} onClick={() => onChange(value === n ? null : n)} style={pill(value === n)}>
          {n} DB
        </button>
      ))}
    </div>
  )
}

// ─── Implement Selector ───────────────────────────────────────────────
function ImplementSelector({ implement, singleArm, side, onChange }) {
  const canBeSA = implement === 'KB' || implement === 'DB'
  const pill = (active) => ({
    backgroundColor: active ? 'rgba(15,247,197,0.14)' : 'rgba(255,255,255,0.07)',
    color: active ? '#0ff7c5' : 'rgba(245,240,232,0.45)',
    border: 'none', borderRadius: 8, padding: '5px 11px',
    fontSize: 12, fontWeight: active ? 700 : 500, letterSpacing: 0.2,
    fontFamily: 'inherit', cursor: 'pointer',
  })
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {['BB', 'KB', 'DB', 'Plate'].map(imp => (
        <button key={imp}
          onClick={() => onChange({ implement: implement === imp ? null : imp, singleArm: false, side: null })}
          style={pill(implement === imp)}
        >{imp}</button>
      ))}
      {canBeSA && (
        <button onClick={() => onChange({ implement, singleArm: !singleArm, side: null })} style={pill(singleArm)}>
          SA
        </button>
      )}
      {canBeSA && singleArm && ['L', 'R'].map(s => (
        <button key={s}
          onClick={() => onChange({ implement, singleArm, side: side === s ? null : s })}
          style={pill(side === s)}
        >{s}</button>
      ))}
    </div>
  )
}

// ─── Drag Handle ──────────────────────────────────────────────────────
function DragHandle({ onMinimize, onDragProgress, onDragEnd }) {
  const ref = useRef(null)
  const startY = useRef(null)
  const currentDrag = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function onStart(e) {
      startY.current = e.touches[0].clientY
      currentDrag.current = 0
    }
    function onMove(e) {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) {
        e.preventDefault()
        currentDrag.current = dy
        onDragProgress?.(dy)
      }
    }
    function onEnd() {
      const dy = currentDrag.current
      if (dy > 80) {
        onMinimize?.()
      } else {
        onDragEnd?.(dy)
      }
      startY.current = null
      currentDrag.current = 0
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [onMinimize, onDragProgress, onDragEnd])

  return (
    <div
      ref={ref}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 0 4px', touchAction: 'none', cursor: 'grab' }}
    >
      <div style={{ width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function LogScreen({ onSave, onClose, initialSession, onMinimize, onDragProgress, onDragEnd }) {
  const s = initialSession
  const initSt = s?.strengthBlock ? parseStrengthStructure(s.strengthBlock.structure) : null

  const [step, setStep] = useState(s ? 2 : 1)

  const [hasStrength, setHasStrength] = useState(s ? !!s.strengthBlock : true)
  const [strengthType, setStrengthType] = useState(initSt?.type ?? 'Traditional')
  const [strengthDuration, setStrengthDuration] = useState(initSt?.duration ?? '')
  const [strengthInterval, setStrengthInterval] = useState(initSt?.interval ?? '1')
  const [strengthMoves, setStrengthMoves] = useState(() =>
    s?.strengthBlock?.movements?.length ? s.strengthBlock.movements.map(restoreStrengthMove) : [newStrengthMove()]
  )

  const [hasMetcon, setHasMetcon] = useState(s ? !!s.metconBlock : true)
  const [metconFormat, setMetconFormat] = useState(s?.metconBlock?.format ?? 'AMRAP')
  const [metconSegments, setMetconSegments] = useState(() => {
    if (s?.metconBlock?.segments?.length) return s.metconBlock.segments.map(seg => restoreSegment(seg, s.metconBlock.format))
    if (s?.metconBlock?.movements?.length) return [{
      restBeforeMin: '', restBeforeSec: '',
      duration: s.metconBlock.duration?.toString() ?? '',
      rounds: s.metconBlock.rounds?.toString() ?? '',
      interval: '1', tabataWork: '20', tabataRest: '10',
      moves: s.metconBlock.movements.map(restoreMetconMove),
    }]
    return [newMetconSegment(false)]
  })
  const [metconScore, setMetconScore] = useState(s?.metconBlock?.score ?? '')
  const [hasBuyIn, setHasBuyIn] = useState(!!(s?.metconBlock?.buyIn?.length))
  const [buyInMoves, setBuyInMoves] = useState(() =>
    s?.metconBlock?.buyIn?.length ? s.metconBlock.buyIn.map(restoreMetconMove) : [newMetconMove()]
  )
  const [hasBuyOut, setHasBuyOut] = useState(!!(s?.metconBlock?.buyOut?.length))
  const [buyOutMoves, setBuyOutMoves] = useState(() =>
    s?.metconBlock?.buyOut?.length ? s.metconBlock.buyOut.map(restoreMetconMove) : [newMetconMove()]
  )

  const [hasAccessory, setHasAccessory] = useState(s ? !!s.accessoryBlock : false)
  const [accessoryType, setAccessoryType] = useState(s?.accessoryBlock?.type ?? 'Traditional')
  const [accessoryTraditionalMoves, setAccessoryTraditionalMoves] = useState(() =>
    s?.accessoryBlock?.type === 'Traditional' && s.accessoryBlock.movements?.length
      ? s.accessoryBlock.movements.map(restoreStrengthMove) : [newStrengthMove()]
  )
  const [accessoryTabataMoves, setAccessoryTabataMoves] = useState(() =>
    s?.accessoryBlock?.type === 'Tabata' && s.accessoryBlock.movements?.length
      ? s.accessoryBlock.movements.map(m => ({ name: m.name || '', rounds: m.rounds?.toString() ?? '8', reps: m.reps?.toString() ?? '', weight: m.weight?.toString() ?? '', notes: m.notes || '' }))
      : [newTabataMove()]
  )
  const [accessoryTabataWork, setAccessoryTabataWork] = useState(
    s?.accessoryBlock?.type === 'Tabata' ? (s.accessoryBlock.movements?.[0]?.work?.toString() ?? '20') : '20'
  )
  const [accessoryTabataRest, setAccessoryTabataRest] = useState(
    s?.accessoryBlock?.type === 'Tabata' ? (s.accessoryBlock.movements?.[0]?.rest?.toString() ?? '10') : '10'
  )

  const [sessionNotes, setSessionNotes] = useState(s?.notes ?? '')
  const [titleStrength, setTitleStrength] = useState(() => {
    if (!s) return ''
    if (s.title) {
      if (!s.strengthBlock) return ''
      return s.title.split(' / ')[0] ?? ''
    }
    const names = (s.strengthBlock?.movements ?? []).map(m => m.name?.trim()).filter(Boolean).slice(0, 2)
    return names.join(' + ')
  })
  const [titleMetcon, setTitleMetcon] = useState(() => {
    if (!s) return ''
    if (s.title) {
      if (!s.metconBlock) return ''
      const raw = s.title.split(' / ')
      return raw[s.strengthBlock ? 1 : 0] ?? ''
    }
    if (!s.metconBlock) return ''
    const { format, duration, rounds } = s.metconBlock
    if (format === 'AMRAP' && duration) return `${duration} min AMRAP`
    if (format === 'OTM') {
      const segs = s.metconBlock.segments
      const iv = segs?.[0]?.interval || 1
      const emomLabel = iv === 1 ? 'EMOM' : `E${iv}MOM`
      if (segs?.length > 1) {
        const hasRestBetween = segs.some((seg, i) => i > 0 && seg.restBefore)
        if (hasRestBetween) {
          const segDurations = segs.map(seg => {
            const slots = [...new Set((seg.movements ?? []).filter(m => !m.isRest && m.minuteAssignment != null).map(m => m.minuteAssignment))].length || 1
            return (seg.rounds || rounds || 0) * iv * slots
          })
          const allSame = segDurations.every(d => d === segDurations[0])
          return allSame && segDurations[0]
            ? `${segDurations[0]} min ${emomLabel} ×${segs.length}`
            : `${segDurations.reduce((a, b) => a + b, 0)} min ${emomLabel}`
        }
        if (rounds) return `${rounds * segs.length * iv} min ${emomLabel}`
      }
      if (rounds) return `${rounds * iv} min ${emomLabel}`
      if (duration) return `${duration} min ${emomLabel}`
      return emomLabel
    }
    if (format === 'For Time') {
      if (Number(rounds) === 1) return 'Chipper'
      if (rounds) return `${rounds} Rounds For Time`
      return 'For Time'
    }
    return format || ''
  })
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(s?.date ?? new Date().toISOString().split('T')[0])
  const [pickerTarget, setPickerTarget] = useState(null)

  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const [photoFile, setPhotoFile] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [showPR, setShowPR] = useState(false)
  const prParticles = useRef(null)
  if (!prParticles.current) {
    prParticles.current = Array.from({ length: 20 }, () => ({
      left: 5 + Math.random() * 90,
      top: 15 + Math.random() * 70,
      size: 3 + Math.random() * 7,
      opacity: 0.2 + Math.random() * 0.6,
      duration: 0.7 + Math.random() * 1.0,
      delay: Math.random() * 0.5,
    }))
  }
  const cameraInputRef = useRef(null)
  const libraryInputRef = useRef(null)

  async function fileToJpegBase64(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 1600
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.88).split(',')[1])
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')) }
      img.src = url
    })
  }

  async function handlePhotoSelect(file) {
    if (!file) return
    setPhotoFile(file)
    if (!hasApiKey) { setStep(2); return }
    setPhotoLoading(true)
    setPhotoError('')
    try {
      const base64 = await fileToJpegBase64(file)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: buildPhotoPrompt() },
          ]}],
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(`API ${res.status}: ${errBody.error?.message || res.statusText}`)
      }
      const data = await res.json()
      const raw = data.content[0].text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const result = JSON.parse(raw)

      if (result.strengthBlock) {
        setHasStrength(true)
        setStrengthType(result.strengthBlock.type || 'Traditional')
        setStrengthDuration(result.strengthBlock.duration != null ? String(result.strengthBlock.duration) : '')
        setStrengthInterval(result.strengthBlock.interval != null ? String(result.strengthBlock.interval) : '1')
        if (result.strengthBlock.movements?.length) setStrengthMoves(result.strengthBlock.movements)
      } else {
        setHasStrength(false)
      }

      if (result.hasMetcon === false) {
        setHasMetcon(false)
      } else {
        setHasMetcon(true)
        if (result.metconFormat) setMetconFormat(result.metconFormat)
        if (result.metconSegments?.length) setMetconSegments(result.metconSegments)
        setHasBuyIn(!!result.hasBuyIn)
        if (result.hasBuyIn && result.buyInMoves?.length) setBuyInMoves(result.buyInMoves)
        setHasBuyOut(!!result.hasBuyOut)
        if (result.hasBuyOut && result.buyOutMoves?.length) setBuyOutMoves(result.buyOutMoves)
      }

      setStep(2)
    } catch (err) {
      console.error(err)
      setPhotoError(err.message?.startsWith('API ') ? err.message : "Couldn't read the whiteboard — try again or enter manually.")
    } finally {
      setPhotoLoading(false)
    }
  }

  function openPicker(block, index, segIndex) {
    setPickerTarget({ block, index, segIndex })
  }

  function handlePickMovement(name) {
    const { block, index, segIndex } = pickerTarget
    if (block === 'strength') {
      setStrengthMoves(prev => prev.map((m, i) => i === index ? { ...m, name } : m))
    } else if (block === 'metcon') {
      setMetconSegments(prev => prev.map((seg, si) => {
        if (si !== segIndex) return seg
        return { ...seg, moves: seg.moves.map((m, mi) => mi === index ? { ...m, name } : m) }
      }))
    } else if (block === 'buyIn') {
      setBuyInMoves(prev => prev.map((m, i) => i === index ? { ...m, name } : m))
    } else if (block === 'buyOut') {
      setBuyOutMoves(prev => prev.map((m, i) => i === index ? { ...m, name } : m))
    } else if (block === 'accessoryTraditional') {
      setAccessoryTraditionalMoves(prev => prev.map((m, i) => i === index ? { ...m, name } : m))
    } else if (block === 'accessoryTabata') {
      setAccessoryTabataMoves(prev => prev.map((m, i) => i === index ? { ...m, name } : m))
    }
    setPickerTarget(null)
  }

  // ── strength helpers ──
  function updateStrengthMove(i, field, val) {
    setStrengthMoves(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }
  function addStrengthMove() { setStrengthMoves(prev => [...prev, newStrengthMove()]) }
  function removeStrengthMove(i) { setStrengthMoves(prev => prev.filter((_, j) => j !== i)) }
  function addWorkingSet(mi) {
    setStrengthMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      const n = m.sets.filter(s => !s.isWarmup).length
      return { ...m, sets: [...m.sets, newWorkingSet(n + 1)] }
    }))
  }
  function addWarmupSet(mi) {
    setStrengthMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      const wn = m.sets.filter(s => s.isWarmup).length
      const warm = m.sets.filter(s => s.isWarmup)
      const work = m.sets.filter(s => !s.isWarmup)
      return { ...m, sets: [...warm, newWarmupSet(wn + 1), ...work] }
    }))
  }
  function updateSet(mi, si, field, val) {
    setStrengthMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      return { ...m, sets: m.sets.map((s, j) => j === si ? { ...s, [field]: val } : s) }
    }))
  }
  function deleteSet(mi, si) {
    setStrengthMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      return { ...m, sets: m.sets.filter((_, j) => j !== si) }
    }))
  }

  // ── buy in / buy out helpers ──
  function updateBuyInMove(i, field, val) {
    setBuyInMoves(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }
  function addBuyInMove() { setBuyInMoves(prev => [...prev, newMetconMove()]) }
  function removeBuyInMove(i) { setBuyInMoves(prev => prev.filter((_, j) => j !== i)) }
  function updateBuyOutMove(i, field, val) {
    setBuyOutMoves(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }
  function addBuyOutMove() { setBuyOutMoves(prev => [...prev, newMetconMove()]) }
  function removeBuyOutMove(i) { setBuyOutMoves(prev => prev.filter((_, j) => j !== i)) }

  // ── metcon segment helpers ──
  function updateSegField(si, field, val) {
    setMetconSegments(prev => prev.map((s, i) => i === si ? { ...s, [field]: val } : s))
  }
  function updateSegMove(si, mi, field, val) {
    setMetconSegments(prev => prev.map((s, i) => {
      if (i !== si) return s
      return { ...s, moves: s.moves.map((m, j) => j === mi ? { ...m, [field]: val } : m) }
    }))
  }
  function addSegMove(si) {
    setMetconSegments(prev => prev.map((s, i) =>
      i === si ? { ...s, moves: [...s.moves, newMetconMove()] } : s
    ))
  }
  function removeSegMove(si, mi) {
    setMetconSegments(prev => prev.map((s, i) => {
      if (i !== si) return s
      return { ...s, moves: s.moves.filter((_, j) => j !== mi) }
    }))
  }
  function addMetconSegment(withRest = true) {
    setMetconSegments(prev => [...prev, newMetconSegment(withRest)])
  }
  function removeMetconSegment(si) {
    setMetconSegments(prev => prev.filter((_, i) => i !== si))
  }

  // ── accessory traditional helpers ──
  function updateAccessoryTradMove(i, field, val) {
    setAccessoryTraditionalMoves(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }
  function addAccessoryTradMove() { setAccessoryTraditionalMoves(prev => [...prev, newStrengthMove()]) }
  function removeAccessoryTradMove(i) { setAccessoryTraditionalMoves(prev => prev.filter((_, j) => j !== i)) }
  function addAccessoryTradWorkingSet(mi) {
    setAccessoryTraditionalMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      const n = m.sets.filter(s => !s.isWarmup).length
      return { ...m, sets: [...m.sets, newWorkingSet(n + 1)] }
    }))
  }
  function addAccessoryTradWarmupSet(mi) {
    setAccessoryTraditionalMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      const wn = m.sets.filter(s => s.isWarmup).length
      const warm = m.sets.filter(s => s.isWarmup)
      const work = m.sets.filter(s => !s.isWarmup)
      return { ...m, sets: [...warm, newWarmupSet(wn + 1), ...work] }
    }))
  }
  function updateAccessoryTradSet(mi, si, field, val) {
    setAccessoryTraditionalMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      return { ...m, sets: m.sets.map((s, j) => j === si ? { ...s, [field]: val } : s) }
    }))
  }
  function deleteAccessoryTradSet(mi, si) {
    setAccessoryTraditionalMoves(prev => prev.map((m, i) => {
      if (i !== mi) return m
      return { ...m, sets: m.sets.filter((_, j) => j !== si) }
    }))
  }

  // ── accessory tabata helpers ──
  function updateAccessoryTabataMove(i, field, val) {
    setAccessoryTabataMoves(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }
  function addAccessoryTabataMove() { setAccessoryTabataMoves(prev => [...prev, newTabataMove()]) }
  function removeAccessoryTabataMove(i) { setAccessoryTabataMoves(prev => prev.filter((_, j) => j !== i)) }

  function buildPhotoPrompt() {
    return `You are parsing a CrossFit/BB WOD whiteboard photo for a workout tracker. Extract the workout exactly as written on the board.

Return ONLY a valid JSON object — no markdown fences, no explanation. Use this exact structure:

{
  "strengthBlock": {
    "type": "Traditional",
    "duration": "",
    "interval": "1",
    "movements": [
      { "name": "Back Squat", "sets": [
        { "num": 1, "reps": "5", "weight": "", "isWarmup": false },
        { "num": 2, "reps": "5", "weight": "", "isWarmup": false }
      ], "notes": "" }
    ]
  },
  "hasMetcon": true,
  "metconFormat": "AMRAP",
  "metconSegments": [
    {
      "restBeforeMin": "", "restBeforeSec": "",
      "duration": "15", "rounds": "", "interval": "1",
      "tabataWork": "20", "tabataRest": "10",
      "moves": [
        { "name": "Thruster", "reps": "9", "weight": "", "minuteAssignment": "", "isRest": false, "restMin": "", "restSec": "", "notes": "" }
      ]
    }
  ],
  "hasBuyIn": false, "buyInMoves": [],
  "hasBuyOut": false, "buyOutMoves": []
}

Strength rules:
- If no strength, set "strengthBlock" to null
- type: "Traditional" for regular sets, "OTM" for every-minute-on-the-minute
- For OTM: "interval" = how many minutes between each set (standard OTM = "1"). "duration" = total workout minutes as string.
- CRITICAL: "x2" or "×2" after OTM means 2 REPS per set — NOT a 2-minute interval. "12 min OTM x2 Power Snatch" = 12 sets of 2 reps with interval "1".
- "E2MOM" or "every 2 min" means interval "2" (set every 2 minutes). This is completely different from "x2" reps.
- For OTM, pre-generate sets: total sets = duration ÷ interval. E.g. 12 min OTM interval=1 → 12 sets; 12 min E2MOM interval=2 → 6 sets.
- For Traditional: pre-generate set rows from the rep scheme (e.g. "5x5" → 5 sets with reps "5"; "3-3-3-3" → 4 sets)
- Leave weight as empty string ""; num must be an integer (1, 2, 3…); reps must be a string
- Common abbreviations: BS=Back Squat, FS=Front Squat, PS/P.SN=Power Snatch, DL=Deadlift, PC=Power Clean, C&J=Clean & Jerk, SN=Snatch, PP=Push Press, PJ=Push Jerk, HPC=Hang Power Clean, HPS=Hang Power Snatch

Metcon rules:
- Weight fields: leave as empty string "" for ALL barbell/dumbbell/kettlebell movements — do NOT guess weights.
- Exception: bodyweight movements (Pull-Up, Chest-to-Bar, Toes to Bar, Handstand Push-Up, Muscle-Up, Ring Dip, Dip, Burpee, Burpee Box Jump Over, Box Jump, Double Under, Push-Up, Air Squat, Sit-Up, Rope Climb, Running, Row, Ski Erg, Assault Bike, Handstand Walk) get weight "0".
- reps must be a string: "10", "21-15-9", "max", etc.
- For AMRAP: duration in minutes in first segment "duration", set "rounds" to ""
- For For Time: number of rounds in "rounds", set "duration" to ""
- For Tabata: set "rounds" (default "8"), tabataWork (sec), tabataRest (sec)
- Multi-segment: add extra segments with restBeforeMin/restBeforeSec set
- Buy-in/buy-out: movements done once before/after the main piece
- Common abbreviations: TTB/T2B=Toes to Bar, KBS=KB Swing, DU=Double Under, BJ=Box Jump, WB=Wall Ball, HSPU=Handstand Push-Up, MU=Muscle-Up, C2B=Chest to Bar, RFT=Rounds for Time, AMRAP=As Many Rounds As Possible, RX=as prescribed

OTM/EMOM metcon — TWO distinct patterns, handle carefully:
PATTERN A — Rotating OTM (each minute is a different movement):
  "12 min OTM: Min 1 x8 Burpee Box Jump, Min 2 x5 DL" means every minute you do ONE movement, alternating.
  → interval="1", each move gets minuteAssignment "1", "2", etc. to show which minute it occupies.
  → Athlete does 6 rounds of each movement over 12 minutes.
PATTERN B — Grouped OTM (all movements happen together every X minutes):
  "E2MOM: 5 DL + 8 Burpee Box Jump" means both movements happen within the same 2-minute window.
  → interval="2" (or however many minutes the window is), all moves get minuteAssignment "" (no assignment).
The key signal: if the board says "Min 1", "Min 2" etc., it is PATTERN A (rotating, interval="1").
If it says "E2MOM" or "every 2 min" with no per-minute labels, it is PATTERN B.`
  }

  function buildGeneratePrompt(request) {
    return `You are a CrossFit/BB WOD programming assistant creating a workout for Leanna, an intermediate barbell + conditioning athlete at a gym in Los Gatos, CA.

Request: "${request}"

Return ONLY a valid JSON object — no markdown fences, no explanation. Use this exact structure:

{
  "strengthBlock": null,
  "hasMetcon": true,
  "metconFormat": "AMRAP",
  "metconSegments": [
    {
      "restBeforeMin": "",
      "restBeforeSec": "",
      "duration": "15",
      "rounds": "",
      "interval": "1",
      "tabataWork": "20",
      "tabataRest": "10",
      "moves": [
        { "name": "Thruster", "reps": "9", "weight": "", "minuteAssignment": "", "isRest": false, "restMin": "", "restSec": "", "notes": "" }
      ]
    }
  ],
  "hasBuyIn": false,
  "buyInMoves": [],
  "hasBuyOut": false,
  "buyOutMoves": []
}

Rules:
- CRITICAL — Total time must exactly match the requested duration. Total time = sum of all segment work periods + sum of all rest periods between segments. Example: user asks for 30 min, you use 3 segments with 3-min rests between them → rest time = 6 min → work time = 24 min → each segment = 8 min. Do the math before outputting.
- Weight fields: leave as empty string "" for ALL barbell/dumbbell/kettlebell movements — do NOT suggest weights.
- Exception: bodyweight movements (Pull-Up, Chest-to-Bar, Toes to Bar, Handstand Push-Up, Muscle-Up, Ring Dip, Dip, Burpee, Burpee Box Jump Over, Box Jump, Double Under, Push-Up, Air Squat, Sit-Up, Rope Climb, Running, Row, Ski Erg, Assault Bike, Handstand Walk) get weight "0".
- reps must be a string: "10", "21-15-9", "max", etc.
- For AMRAP: put duration in minutes in first segment "duration", set "rounds" to ""
- For For Time: put number of rounds in "rounds", set "duration" to ""
- For OTM: set "duration" (total min) and "interval" (every X min); each move gets "minuteAssignment" "1", "2", etc.
- For Tabata: set "rounds" (default "8"), "tabataWork" (sec), "tabataRest" (sec)
- Multi-segment workouts: add extra segments with "restBeforeMin"/"restBeforeSec" set
- If the request is only for a metcon, set strengthBlock to null
- Common movements to use: Thruster, Power Snatch, Deadlift, Pull-Up, Box Jump, KB Swing, Row, Burpee, Toes to Bar, Wall Ball, Double Under, Clean, Push Press`
  }

  async function generateWorkout() {
    if (!generatePrompt.trim()) return
    if (!hasApiKey) { setGenerateError('API key required — skip to enter manually.'); return }
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: buildGeneratePrompt(generatePrompt.trim()) }],
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(`API ${res.status}: ${errBody.error?.message || res.statusText}`)
      }
      const data = await res.json()
      const raw = data.content[0].text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const result = JSON.parse(raw)

      if (result.strengthBlock) {
        setHasStrength(true)
        setStrengthType(result.strengthBlock.type || 'Traditional')
        setStrengthDuration(result.strengthBlock.duration != null ? String(result.strengthBlock.duration) : '')
        setStrengthInterval(result.strengthBlock.interval != null ? String(result.strengthBlock.interval) : '1')
        if (result.strengthBlock.movements?.length) setStrengthMoves(result.strengthBlock.movements)
      } else {
        setHasStrength(false)
      }

      if (result.hasMetcon === false) {
        setHasMetcon(false)
      } else {
        setHasMetcon(true)
        if (result.metconFormat) setMetconFormat(result.metconFormat)
        if (result.metconSegments?.length) setMetconSegments(result.metconSegments)
        setHasBuyIn(!!result.hasBuyIn)
        if (result.hasBuyIn && result.buyInMoves?.length) setBuyInMoves(result.buyInMoves)
        setHasBuyOut(!!result.hasBuyOut)
        if (result.hasBuyOut && result.buyOutMoves?.length) setBuyOutMoves(result.buyOutMoves)
      }

      setStep(2)
    } catch (err) {
      console.error(err)
      setGenerateError(err.message || "Couldn't generate a workout — try again.")
    } finally {
      setGenerating(false)
    }
  }

  function generateSessionTitle() {
    const st = titleStrength.trim()
    const mt = titleMetcon.trim()
    if (st || mt) {
      const titleParts = [st, mt].filter(Boolean)
      if (hasAccessory) titleParts.push('Accessory')
      return titleParts.join(' / ') || 'BB WOD'
    }

    const parts = []

    if (hasStrength) {
      const names = strengthMoves.map(m => m.name.trim()).filter(Boolean).slice(0, 2)
      if (names.length) parts.push(names.join(' + '))
    }

    if (hasMetcon) {
      const seg = metconSegments[0]
      let label = metconFormat
      if (metconSegments.length > 1) {
        if (metconFormat === 'OTM') {
          const iv = Number(seg?.interval) || 1
          const emomLabel = iv === 1 ? 'EMOM' : `E${iv}MOM`
          const hasRestBetween = metconSegments.some((s, i) => i > 0 && (s.restBeforeMin || s.restBeforeSec))
          if (hasRestBetween) {
            const segDurations = metconSegments.map(s => {
              const slots = [...new Set(s.moves.filter(m => !m.isRest && m.minuteAssignment).map(m => m.minuteAssignment))].length || 1
              return Number(s.rounds || 0) * iv * slots
            })
            const allSame = segDurations.every(d => d === segDurations[0])
            label = allSame && segDurations[0]
              ? `${segDurations[0]} min ${emomLabel} ×${metconSegments.length}`
              : `${segDurations.reduce((a, b) => a + b, 0)} min ${emomLabel}`
          } else {
            const r = Number(seg?.rounds)
            label = r ? `${r * metconSegments.length * iv} min ${emomLabel}` : `${metconSegments.length} min ${emomLabel}`
          }
        } else {
          const totalWorkMin = metconSegments.reduce((sum, s) => sum + (Number(s.duration) || 0), 0)
          const totalRestMin = metconSegments.reduce((sum, s) => sum + (Number(s.restBeforeMin) || 0) + (Number(s.restBeforeSec) || 0) / 60, 0)
          const total = Math.round(totalWorkMin + totalRestMin)
          const allSame = metconSegments.every(s => s.duration === seg?.duration)
          if (allSame && seg?.duration) {
            label = `${seg.duration} min ${metconFormat} ×${metconSegments.length}`
          } else {
            label = `${total} min Metcon`
          }
        }
      } else if (metconFormat === 'AMRAP' && seg?.duration) {
        label = `${seg.duration} min AMRAP`
      } else if (metconFormat === 'OTM') {
        const iv = Number(seg?.interval) || 1
        const emomLabel = iv === 1 ? 'EMOM' : `E${iv}MOM`
        const r = Number(seg?.rounds)
        if (r) label = `${r * iv} min ${emomLabel}`
        else if (seg?.duration) label = `${seg.duration} min ${emomLabel}`
      } else if (metconFormat === 'For Time' && seg?.rounds) {
        label = Number(seg.rounds) === 1 ? 'Chipper' : `${seg.rounds} Rounds For Time`
      }
      parts.push(label)
    }

    if (hasAccessory) parts.push('Accessory')

    return parts.join(' / ') || 'BB WOD'
  }

  async function handleLog() {
    setSaving(true)
    try {
      const firstSeg = metconSegments[0]
      const sessionData = {
        title: generateSessionTitle(),
        date: date,
        program: 'BB WOD',
        strengthBlock: hasStrength ? {
          title: strengthMoves[0]?.name || '',
          structure: strengthType === 'OTM'
            ? `${strengthDuration} min OTM every ${strengthInterval} min`
            : strengthType,
          movements: strengthMoves.map(m => ({
            name: m.name,
            implement: m.implement ?? null,
            singleArm: m.singleArm ?? false,
            side: m.side ?? null,
            sets: m.sets.map((s, idx) => ({
              setNumber: idx + 1,
              reps: s.reps !== '' ? Number(s.reps) : null,
              weight: s.weight !== '' ? Number(s.weight) : null,
              weightUnit: 'lbs',
              isFailure: false, isPR: false,
              notation: s.isWarmup ? 'warmup' : null,
            })),
            notes: m.notes || '',
          })),
          notes: '',
        } : null,
        metconBlock: hasMetcon ? {
          format: metconFormat,
          // top-level fields from first segment for HomeScreen display
          duration: metconFormat !== 'For Time' && metconFormat !== 'Ladder' && metconFormat !== 'Tabata' && firstSeg.duration !== '' ? Number(firstSeg.duration) : null,
          rounds: (metconFormat === 'For Time' || metconFormat === 'OTM' || metconFormat === 'Tabata') && firstSeg.rounds !== '' ? Number(firstSeg.rounds) : null,
          score: metconScore || null,
          buyIn: hasBuyIn ? buyInMoves.map(m => m.isRest ? {
            isRest: true,
            restSeconds: (m.restMin !== '' ? Number(m.restMin) * 60 : 0) + (m.restSec !== '' ? Number(m.restSec) : 0),
          } : {
            name: m.name, reps: m.reps || null,
            weight: m.weight !== '' ? Number(m.weight) : null, weightUnit: 'lbs',
          }) : null,
          buyOut: hasBuyOut ? buyOutMoves.map(m => m.isRest ? {
            isRest: true,
            restSeconds: (m.restMin !== '' ? Number(m.restMin) * 60 : 0) + (m.restSec !== '' ? Number(m.restSec) : 0),
          } : {
            name: m.name, reps: m.reps || null,
            weight: m.weight !== '' ? Number(m.weight) : null, weightUnit: 'lbs',
          }) : null,
          segments: metconSegments.map(seg => ({
            restBefore: (seg.restBeforeMin !== '' || seg.restBeforeSec !== '') ? (Number(seg.restBeforeMin || 0) * 60 + Number(seg.restBeforeSec || 0)) : null,
            duration: metconFormat !== 'For Time' && metconFormat !== 'Ladder' && metconFormat !== 'Tabata' && seg.duration !== '' ? Number(seg.duration) : null,
            rounds: (metconFormat === 'For Time' || metconFormat === 'OTM' || metconFormat === 'Tabata') && seg.rounds !== '' ? Number(seg.rounds) : null,
            interval: metconFormat === 'OTM' && seg.interval !== '' ? Number(seg.interval) : null,
            work: metconFormat === 'Tabata' ? (seg.tabataWork !== '' ? Number(seg.tabataWork) : 20) : null,
            rest: metconFormat === 'Tabata' ? (seg.tabataRest !== '' ? Number(seg.tabataRest) : 10) : null,
            movements: seg.moves.map(m => m.isRest ? {
              isRest: true,
              restSeconds: (m.restMin !== '' ? Number(m.restMin) * 60 : 0) + (m.restSec !== '' ? Number(m.restSec) : 0),
              minuteAssignment: m.minuteAssignment !== '' ? Number(m.minuteAssignment) : null,
            } : {
              name: m.name,
              reps: (metconFormat === 'Ladder' && seg.ladderScheme) ? seg.ladderScheme : (m.reps || null),
              weight: m.weight !== '' ? Number(m.weight) : null,
              weightUnit: 'lbs',
              implement: m.implement ?? null,
              singleArm: m.singleArm ?? false,
              side: m.side ?? null,
              minuteAssignment: m.minuteAssignment !== '' ? Number(m.minuteAssignment) : null,
              notes: m.notes || null,
            }),
          })),
        } : null,
        accessoryBlock: hasAccessory ? {
          type: accessoryType,
          movements: accessoryType === 'Traditional'
            ? accessoryTraditionalMoves.map(m => ({
                name: m.name,
                implement: m.implement ?? null,
                singleArm: m.singleArm ?? false,
                side: m.side ?? null,
                sets: m.sets.map((s, idx) => ({
                  setNumber: idx + 1,
                  reps: s.reps !== '' ? Number(s.reps) : null,
                  weight: s.weight !== '' ? Number(s.weight) : null,
                  weightUnit: 'lbs',
                  notation: s.isWarmup ? 'warmup' : null,
                })),
                notes: m.notes || '',
              }))
            : accessoryTabataMoves.map(m => ({
                name: m.name,
                rounds: m.rounds !== '' ? Number(m.rounds) : 8,
                reps: m.reps || null,
                weight: m.weight !== '' ? Number(m.weight) : null,
                weightUnit: 'lbs',
                work: accessoryTabataWork !== '' ? Number(accessoryTabataWork) : 20,
                rest: accessoryTabataRest !== '' ? Number(accessoryTabataRest) : 10,
                notes: m.notes || null,
              })),
        } : null,
        notes: sessionNotes,
        whiteboardPhotoUrl: null,
      }

      const sessionId = initialSession?.id ?? uuidv4()
      const fullSession = { ...sessionData, id: sessionId }
      if (initialSession?.id) {
        await supabase.from('sessions').update(sessionToRow(fullSession)).eq('id', sessionId)
      } else {
        await supabase.from('sessions').insert(sessionToRow(fullSession))
      }
      const savedId = sessionId

      // PR detection on new sessions only
      let gotPR = false
      if (!initialSession?.id && sessionData.strengthBlock) {
        const updatedBlock = await detectPRs(savedId, sessionData.date, sessionData.strengthBlock)
        if (updatedBlock) {
          await supabase.from('sessions').update({ strength_block: updatedBlock }).eq('id', savedId)
          gotPR = true
        }
      }

      const allNames = [
        ...(hasStrength ? strengthMoves.map(m => m.name.trim()) : []),
        ...(hasMetcon ? metconSegments.flatMap(s => s.moves.filter(m => !m.isRest).map(m => m.name.trim())) : []),
        ...(hasMetcon && hasBuyIn ? buyInMoves.filter(m => !m.isRest).map(m => m.name.trim()) : []),
        ...(hasMetcon && hasBuyOut ? buyOutMoves.filter(m => !m.isRest).map(m => m.name.trim()) : []),
        ...(hasAccessory && accessoryType === 'Traditional' ? accessoryTraditionalMoves.map(m => m.name.trim()) : []),
        ...(hasAccessory && accessoryType === 'Tabata' ? accessoryTabataMoves.map(m => m.name.trim()) : []),
      ].filter(Boolean)
      for (const name of allNames) {
        const { count } = await supabase.from('movements').select('*', { count: 'exact', head: true }).eq('name', name)
        if (!count) await supabase.from('movements').insert({ id: crypto.randomUUID(), name, aliases: [], category: 'other', prs: [] })
      }

      if (gotPR) {
        setShowPR(true)
        setTimeout(() => { setShowPR(false); onSave?.() }, 2200)
      } else {
        onSave?.()
      }
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  // ─── Step 1 ───────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 40, display: 'flex', flexDirection: 'column' }}>
        <DragHandle onMinimize={onMinimize} onDragProgress={onDragProgress} onDragEnd={onDragEnd} />
        <div style={{ padding: '12px 20px 24px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff7c5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0, marginBottom: 12, opacity: 0.8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <p style={{ color: '#0ff7c5', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, margin: '0 0 8px', fontFamily: 'inherit' }}>
            {formatDate(new Date().toISOString().split('T')[0])}
          </p>
          <h1 style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.2, margin: 0, fontFamily: 'inherit' }}>New Session</h1>
        </div>

        {/* hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handlePhotoSelect(e.target.files?.[0])} />
        <input ref={libraryInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoSelect(e.target.files?.[0])} />

        <div style={{ margin: '0 20px', backgroundColor: '#201a2a', borderRadius: 20, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, border: `1px ${photoLoading ? 'solid rgba(245,240,232,0.08)' : 'dashed rgba(245,240,232,0.15)'}` }}>
          {photoLoading ? (
            <>
              <style>{`@keyframes log-spin { to { transform: rotate(360deg) } }`}</style>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(245,240,232,0.1)', borderTopColor: 'rgba(245,240,232,0.7)', animation: 'log-spin 0.8s linear infinite' }} />
              <p style={{ color: '#f5f0e8', fontSize: 17, fontWeight: 600, margin: 0, fontFamily: 'inherit' }}>Reading whiteboard…</p>
              <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: 14, margin: 0, textAlign: 'center', lineHeight: 1.4, fontFamily: 'inherit' }}>
                Claude is parsing your photo
              </p>
            </>
          ) : (
            <>
              <div style={{ width: 72, height: 72, backgroundColor: 'rgba(245,240,232,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <p style={{ color: '#f5f0e8', fontSize: 17, fontWeight: 600, margin: 0, fontFamily: 'inherit' }}>Capture Whiteboard</p>
              <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: 14, margin: 0, textAlign: 'center', lineHeight: 1.4, fontFamily: 'inherit' }}>
                Point your camera at the WOD whiteboard — Claude will parse it for you.
              </p>
              <button onClick={() => cameraInputRef.current?.click()} style={{ marginTop: 4, backgroundColor: 'transparent', color: '#0ff7c5', border: '1.5px solid rgba(15,247,197,0.5)', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                Open Camera
              </button>
              <button onClick={() => libraryInputRef.current?.click()} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(245,240,232,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                Choose from Library
              </button>
              {photoError && (
                <p style={{ color: '#e05c4b', fontSize: 13, margin: '4px 0 0', textAlign: 'center', fontFamily: 'inherit' }}>{photoError}</p>
              )}
            </>
          )}
        </div>

        {hasApiKey && (
          <>
            {/* Ask Claude divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px' }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'inherit' }}>or ask Claude</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Generate section */}
            <div style={{ padding: '0 20px' }}>
              <style>{`.generate-ta::placeholder { color: rgba(245,240,232,0.25); font-style: italic; } .generate-ta:focus::placeholder { color: transparent; }`}</style>
              <textarea
                className="generate-ta"
                placeholder='"15-min metcon with barbell and row"'
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                rows={2}
                style={{ ...inputBase, resize: 'none', lineHeight: 1.5, marginBottom: 10 }}
              />
              {generateError && (
                <p style={{ color: '#e05c4b', fontSize: 13, margin: '0 0 10px', fontFamily: 'inherit' }}>{generateError}</p>
              )}
              <button
                onClick={generateWorkout}
                disabled={generating || !generatePrompt.trim()}
                style={{
                  width: '100%',
                  backgroundColor: generating || !generatePrompt.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(245,240,232,0.1)',
                  color: generating || !generatePrompt.trim() ? 'rgba(245,240,232,0.25)' : '#f5f0e8',
                  border: '1px solid rgba(245,240,232,0.12)',
                  borderRadius: 14, padding: '15px 24px',
                  fontSize: 15, fontWeight: 600,
                  cursor: generating || !generatePrompt.trim() ? 'default' : 'pointer',
                  fontFamily: 'inherit', letterSpacing: -0.1,
                }}
              >
                {generating ? 'Generating…' : 'Generate Workout'}
              </button>
            </div>
          </>
        )}

        <button onClick={() => setStep(2)} style={{ alignSelf: 'center', marginTop: 20, background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0', textDecoration: 'underline', textDecorationColor: 'rgba(245,240,232,0.25)', textUnderlineOffset: 3 }}>
          Skip — enter manually
        </button>
      </div>
    )
  }

  // ─── Step 2: Editor ───────────────────────────────────────────────
  return (
    <>
      {showPR && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(10,10,10,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'pr-overlay 2.2s ease forwards' }}>
          <style>{`
            @keyframes pr-overlay { 0%{opacity:0} 15%{opacity:1} 75%{opacity:1} 100%{opacity:0} }
            @keyframes pr-pop { 0%{transform:scale(0.4);opacity:0} 55%{transform:scale(1.08)} 75%{transform:scale(0.97)} 100%{transform:scale(1);opacity:1} }
            @keyframes chalk-up { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-100px) scale(0.2);opacity:0} }
          `}</style>
          {prParticles.current.map((p, i) => (
            <div key={i} style={{ position: 'absolute', left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, borderRadius: '50%', backgroundColor: `rgba(245,240,232,${p.opacity})`, animation: `chalk-up ${p.duration}s ${p.delay}s ease-out forwards` }} />
          ))}
          <div style={{ animation: 'pr-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.15s both', textAlign: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', backgroundColor: 'rgba(192,57,43,0.18)', border: '2px solid rgba(192,57,43,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span style={{ color: '#e05c4b', fontSize: 30, fontWeight: 900, fontFamily: 'inherit', letterSpacing: -1 }}>PR</span>
            </div>
            <p style={{ color: '#f5f0e8', fontSize: 30, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.8, fontFamily: 'inherit' }}>New Personal Record</p>
            <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: 15, margin: 0, fontFamily: 'inherit' }}>Logged and saved</p>
          </div>
        </div>
      )}
      {pickerTarget && <LibrarySheet onSelect={handlePickMovement} onClose={() => setPickerTarget(null)} />}

      <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 100 }}>
        <DragHandle onMinimize={onMinimize} onDragProgress={onDragProgress} onDragEnd={onDragEnd} />

        {/* Header */}
        <div style={{ padding: '12px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => initialSession ? onClose?.() : setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff7c5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0, opacity: 0.8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
            {onMinimize && (
              <button onClick={onMinimize} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.38)', padding: 4, lineHeight: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
          </div>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5, margin: '0 0 8px' }}>
            <p style={{ color: '#0ff7c5', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, margin: 0, fontFamily: 'inherit' }}>
              {formatDate(date)}
            </p>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0ff7c5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
          </div>
          <h1 style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.2, margin: 0, fontFamily: 'inherit' }}>
            {initialSession ? 'Edit Session' : 'Log Workout'}
          </h1>
          {initialSession && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <style>{`.title-field::placeholder{color:rgba(245,240,232,0.25);font-style:italic}.title-field:focus::placeholder{color:transparent}`}</style>
              {[
                hasStrength && { emoji: '💪', value: titleStrength, set: setTitleStrength, ph: 'Strength title…' },
                hasMetcon   && { emoji: '⚡', value: titleMetcon,   set: setTitleMetcon,   ph: 'Metcon title…' },
                hasAccessory && { emoji: '⭐', value: 'Accessory', set: () => {}, ph: 'Accessory' },
              ].filter(Boolean).map(({ emoji, value, set, ph }) => (
                <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0, userSelect: 'none' }}>{emoji}</span>
                  <input
                    className="title-field"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={ph}
                    readOnly={emoji === '⭐'}
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 14, color: emoji === '⭐' ? 'rgba(245,240,232,0.4)' : '#f5f0e8', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── STRENGTH ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
          <span style={{ color: '#f5f0e8', fontSize: 18, fontWeight: 700, letterSpacing: -0.3, fontFamily: 'inherit' }}>Strength</span>
          <button onClick={() => setHasStrength(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>
            {hasStrength ? 'Remove' : 'Add'}
          </button>
        </div>

        {hasStrength && (
          <div style={{ padding: '0 20px' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: strengthType === 'OTM' ? 12 : 0 }}>
                {['Traditional', 'OTM'].map(type => (
                  <button key={type} onClick={() => setStrengthType(type)} style={{ flexShrink: 0, backgroundColor: strengthType === type ? 'rgba(15,247,197,0.14)' : 'rgba(255,255,255,0.07)', color: strengthType === type ? '#0ff7c5' : 'rgba(245,240,232,0.5)', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: strengthType === type ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {type}
                  </button>
                ))}
              </div>
              {strengthType === 'OTM' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={labelStyle}>Duration (min)</p>
                    <input placeholder="12" value={strengthDuration} onChange={e => setStrengthDuration(e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={labelStyle}>Every (min)</p>
                    <input placeholder="1" value={strengthInterval} onChange={e => setStrengthInterval(e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                  </div>
                </div>
              )}
            </div>

            {strengthMoves.map((move, mi) => (
              <div key={mi} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px 14px 10px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    placeholder={`Movement ${mi + 1}…`} value={move.name}
                    onChange={e => updateStrengthMove(mi, 'name', e.target.value)}
                    style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 500, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button onClick={() => openPicker('strength', mi)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                    Library
                  </button>
                  <button onClick={() => removeStrengthMove(mi)} style={{ backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 13, color: '#ff6b5e', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>×</button>
                </div>
                <SuggestButton name={move.name} sets={move.sets} />
                <ImplementSelector
                  implement={move.implement}
                  singleArm={move.singleArm}
                  side={move.side}
                  onChange={({ implement, singleArm, side }) =>
                    setStrengthMoves(prev => prev.map((m, i) => i === mi ? { ...m, implement, singleArm, side } : m))
                  }
                />
                <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
                  <span style={{ width: 28, flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit', letterSpacing: 0.3 }}>REPS</span>
                  <span style={{ flex: 1.6, textAlign: 'center', fontSize: 11, color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit', letterSpacing: 0.3 }}>WEIGHT</span>
                  <span style={{ width: 26, flexShrink: 0 }} /><span style={{ width: 26, flexShrink: 0 }} />
                </div>
                {move.sets.map((set, si) => (
                  <SetRow key={si} set={set} onChange={(f, v) => updateSet(mi, si, f, v)} onDelete={() => deleteSet(mi, si)} />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => addWarmupSet(mi)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, color: 'rgba(245,240,232,0.4)', fontFamily: 'inherit', cursor: 'pointer' }}>+ Warmup</button>
                  <button onClick={() => addWorkingSet(mi)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer' }}>+ Set</button>
                </div>
              </div>
            ))}
            <button onClick={addStrengthMove} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 4 }}>
              + Add Movement
            </button>
          </div>
        )}

        {/* ── METCON ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px' }}>
          <span style={{ color: '#f5f0e8', fontSize: 18, fontWeight: 700, letterSpacing: -0.3, fontFamily: 'inherit' }}>Metcon</span>
          <button onClick={() => setHasMetcon(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>
            {hasMetcon ? 'Remove' : 'Add'}
          </button>
        </div>

        {hasMetcon && (
          <div style={{ padding: '0 20px' }}>
            {/* Buy In */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasBuyIn ? 10 : 14 }}>
              <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'inherit' }}>Buy In</span>
              <button onClick={() => setHasBuyIn(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>
                {hasBuyIn ? 'Remove' : 'Add'}
              </button>
            </div>
            {hasBuyIn && (
              <>
                {buyInMoves.map((move, mi) => (
                  <div key={mi} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {move.isRest ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px' }}>
                          <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'inherit' }}>Rest</span>
                        </div>
                      ) : (
                        <input placeholder={`Movement ${mi + 1}…`} value={move.name} onChange={e => updateBuyInMove(mi, 'name', e.target.value)} style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 500, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none' }} />
                      )}
                      {!move.isRest && <button onClick={() => openPicker('buyIn', mi)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>Library</button>}
                      <button onClick={() => updateBuyInMove(mi, 'isRest', !move.isRest)} style={{ backgroundColor: move.isRest ? 'rgba(245,240,232,0.12)' : 'rgba(255,255,255,0.06)', color: move.isRest ? '#f5f0e8' : 'rgba(245,240,232,0.35)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>Rest</button>
                      {buyInMoves.length > 1 && <button onClick={() => removeBuyInMove(mi)} style={{ backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 13, color: '#ff6b5e', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>×</button>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {move.isRest ? (
                        <>
                          <input placeholder="0" value={move.restMin} onChange={e => updateBuyInMove(mi, 'restMin', e.target.value)} type="number" inputMode="numeric" style={{ width: 56, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>min</span>
                          <input placeholder="30" value={move.restSec} onChange={e => updateBuyInMove(mi, 'restSec', e.target.value)} type="number" inputMode="numeric" style={{ width: 56, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>sec</span>
                        </>
                      ) : (
                        <>
                          <input placeholder="Reps or 15-12-9" value={move.reps} onChange={e => updateBuyInMove(mi, 'reps', e.target.value)} style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                          <input placeholder="lbs" value={move.weight} onChange={e => updateBuyInMove(mi, 'weight', e.target.value)} type="number" inputMode="decimal" style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                        </>
                      )}
                    </div>
                    {!move.isRest && isLadder(move.reps) && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit', letterSpacing: 0.3 }}>
                          {parseLadder(move.reps).join(' → ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={addBuyInMove} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 16 }}>
                  + Add Movement
                </button>
              </>
            )}

            {/* Format pills — shared across all segments */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
              {FORMATS.map(fmt => (
                <button key={fmt} onClick={() => setMetconFormat(fmt)} style={{ flexShrink: 0, backgroundColor: metconFormat === fmt ? 'rgba(15,247,197,0.14)' : 'rgba(255,255,255,0.07)', color: metconFormat === fmt ? '#0ff7c5' : 'rgba(245,240,232,0.5)', border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: metconFormat === fmt ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {fmt}
                </button>
              ))}
            </div>

            {/* Segments */}
            {metconSegments.map((seg, si) => (
              <div key={si}>
                {/* Divider before segments 2+ */}
                {si > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                    <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    {(seg.restBeforeMin !== '' || seg.restBeforeSec !== '') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '7px 12px' }}>
                        <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'inherit' }}>Rest</span>
                        <input
                          value={seg.restBeforeMin}
                          onChange={e => updateSegField(si, 'restBeforeMin', e.target.value)}
                          type="number" inputMode="numeric" placeholder="2"
                          style={{ width: 32, backgroundColor: 'transparent', border: 'none', color: '#f5f0e8', fontSize: 16, fontWeight: 600, outline: 'none', textAlign: 'center', fontFamily: 'inherit', padding: 0 }}
                        />
                        <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 12, fontFamily: 'inherit' }}>min</span>
                        <input
                          value={seg.restBeforeSec}
                          onChange={e => updateSegField(si, 'restBeforeSec', e.target.value)}
                          type="number" inputMode="numeric" placeholder="0"
                          style={{ width: 32, backgroundColor: 'transparent', border: 'none', color: '#f5f0e8', fontSize: 16, fontWeight: 600, outline: 'none', textAlign: 'center', fontFamily: 'inherit', padding: 0 }}
                        />
                        <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 12, fontFamily: 'inherit' }}>sec</span>
                      </div>
                    ) : (
                      <div style={{ flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <button onClick={() => removeMetconSegment(si)} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff6b5e" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Per-segment fields */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  {metconFormat !== 'For Time' && metconFormat !== 'Ladder' && metconFormat !== 'Tabata' && (
                    <div style={{ flex: 1 }}>
                      <p style={labelStyle}>Duration (min)</p>
                      <input placeholder="20" value={seg.duration} onChange={e => updateSegField(si, 'duration', e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                    </div>
                  )}
                  {(metconFormat === 'For Time' || metconFormat === 'OTM' || metconFormat === 'Tabata') && (
                    <div style={{ flex: 1 }}>
                      <p style={labelStyle}>Rounds</p>
                      <input placeholder={metconFormat === 'Tabata' ? '8' : '4'} value={seg.rounds} onChange={e => updateSegField(si, 'rounds', e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                    </div>
                  )}
                  {metconFormat === 'Tabata' && (
                    <div style={{ flex: 1 }}>
                      <p style={labelStyle}>Work (sec)</p>
                      <input placeholder="20" value={seg.tabataWork} onChange={e => updateSegField(si, 'tabataWork', e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                    </div>
                  )}
                  {metconFormat === 'Tabata' && (
                    <div style={{ flex: 1 }}>
                      <p style={labelStyle}>Rest (sec)</p>
                      <input placeholder="10" value={seg.tabataRest} onChange={e => updateSegField(si, 'tabataRest', e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                    </div>
                  )}
                  {metconFormat === 'OTM' && (
                    <div style={{ flex: 1 }}>
                      <p style={labelStyle}>Every (min)</p>
                      <input placeholder="1" value={seg.interval} onChange={e => updateSegField(si, 'interval', e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                    </div>
                  )}
                </div>

                {/* Ladder rep scheme — entered once, applies to all movements */}
                {metconFormat === 'Ladder' && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={labelStyle}>Rep Scheme</p>
                    <input
                      placeholder="e.g. 27-21-15-9"
                      value={seg.ladderScheme}
                      onChange={e => updateSegField(si, 'ladderScheme', e.target.value)}
                      style={inputBase}
                    />
                    {seg.ladderScheme && isLadder(seg.ladderScheme) && (
                      <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, margin: '6px 0 0', fontFamily: 'inherit' }}>
                        {parseLadder(seg.ladderScheme).join(' → ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Movements */}
                {seg.moves.map((move, mi) => (
                  <div key={mi} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {move.isRest ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px' }}>
                          <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'inherit' }}>Rest</span>
                        </div>
                      ) : (
                        <input
                          placeholder={`Movement ${mi + 1}…`} value={move.name}
                          onChange={e => updateSegMove(si, mi, 'name', e.target.value)}
                          style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 500, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none' }}
                        />
                      )}
                      {!move.isRest && (
                        <button onClick={() => openPicker('metcon', mi, si)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                          Library
                        </button>
                      )}
                      <button
                        onClick={() => updateSegMove(si, mi, 'isRest', !move.isRest)}
                        style={{ backgroundColor: move.isRest ? 'rgba(245,240,232,0.12)' : 'rgba(255,255,255,0.06)', color: move.isRest ? '#f5f0e8' : 'rgba(245,240,232,0.35)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Rest
                      </button>
                      {seg.moves.length > 1 && (
                        <button onClick={() => removeSegMove(si, mi)} style={{ backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 13, color: '#ff6b5e', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>×</button>
                      )}
                    </div>
                    <div>
                      {!move.isRest && (
                        <ImplementSelector
                          implement={move.implement}
                          singleArm={move.singleArm}
                          side={move.side}
                          onChange={({ implement, singleArm, side }) =>
                            setMetconSegments(prev => prev.map((sg, sgi) =>
                              sgi === si ? {
                                ...sg,
                                moves: sg.moves.map((m, mii) => mii === mi ? { ...m, implement, singleArm, side } : m)
                              } : sg
                            ))
                          }
                        />
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {move.isRest ? (
                          <>
                            <input placeholder="0" value={move.restMin} onChange={e => updateSegMove(si, mi, 'restMin', e.target.value)} type="number" inputMode="numeric" style={{ width: 56, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                            <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>min</span>
                            <input placeholder="30" value={move.restSec} onChange={e => updateSegMove(si, mi, 'restSec', e.target.value)} type="number" inputMode="numeric" style={{ width: 56, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                            <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>sec</span>
                            {metconFormat === 'OTM' && (
                              <input placeholder="Min #" value={move.minuteAssignment} onChange={e => updateSegMove(si, mi, 'minuteAssignment', e.target.value)} type="number" inputMode="numeric" style={{ width: 60, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center', marginLeft: 'auto' }} />
                            )}
                          </>
                        ) : (
                          <>
                            {metconFormat !== 'Ladder' && (
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <input placeholder="—" value={move.reps} onChange={e => updateSegMove(si, mi, 'reps', e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
                                <span style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit' }}>reps</span>
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <input placeholder="—" value={move.weight} onChange={e => updateSegMove(si, mi, 'weight', e.target.value)} type="number" inputMode="decimal" style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
                              <span style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit' }}>lbs</span>
                            </div>
                            {metconFormat === 'OTM' && (
                              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <input placeholder="—" value={move.minuteAssignment} onChange={e => updateSegMove(si, mi, 'minuteAssignment', e.target.value)} type="number" inputMode="numeric" style={{ width: 60, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '8px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
                                <span style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit' }}>min #</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {!move.isRest && metconFormat !== 'Ladder' && isLadder(move.reps) && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit', letterSpacing: 0.3 }}>
                            {parseLadder(move.reps).join(' → ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button onClick={() => addSegMove(si)} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer' }}>
                  + Add Movement
                </button>
              </div>
            ))}

            {/* Add segment buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => addMetconSegment(false)}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                + Segment
              </button>
              <button
                onClick={() => addMetconSegment(true)}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                + Rest + Segment
              </button>
            </div>

            {/* Score — single field for the whole metcon */}
            <div style={{ marginTop: 16 }}>
              <p style={labelStyle}>
                {metconFormat === 'AMRAP' ? 'Score (rounds + reps)' : (metconFormat === 'For Time' || metconFormat === 'Ladder') ? 'Time (MM:SS)' : 'Score'}
              </p>
              <input
                placeholder={metconFormat === 'AMRAP' ? '12 rounds + 5 reps' : (metconFormat === 'For Time' || metconFormat === 'Ladder') ? '14:32' : ''}
                value={metconScore} onChange={e => setMetconScore(e.target.value)} style={inputBase}
              />
            </div>

            {/* Buy Out */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: hasBuyOut ? 10 : 0 }}>
              <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'inherit' }}>Buy Out</span>
              <button onClick={() => setHasBuyOut(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>
                {hasBuyOut ? 'Remove' : 'Add'}
              </button>
            </div>
            {hasBuyOut && (
              <>
                {buyOutMoves.map((move, mi) => (
                  <div key={mi} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {move.isRest ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px' }}>
                          <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'inherit' }}>Rest</span>
                        </div>
                      ) : (
                        <input placeholder={`Movement ${mi + 1}…`} value={move.name} onChange={e => updateBuyOutMove(mi, 'name', e.target.value)} style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 500, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none' }} />
                      )}
                      {!move.isRest && <button onClick={() => openPicker('buyOut', mi)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>Library</button>}
                      <button onClick={() => updateBuyOutMove(mi, 'isRest', !move.isRest)} style={{ backgroundColor: move.isRest ? 'rgba(245,240,232,0.12)' : 'rgba(255,255,255,0.06)', color: move.isRest ? '#f5f0e8' : 'rgba(245,240,232,0.35)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>Rest</button>
                      {buyOutMoves.length > 1 && <button onClick={() => removeBuyOutMove(mi)} style={{ backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 13, color: '#ff6b5e', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>×</button>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {move.isRest ? (
                        <>
                          <input placeholder="0" value={move.restMin} onChange={e => updateBuyOutMove(mi, 'restMin', e.target.value)} type="number" inputMode="numeric" style={{ width: 56, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>min</span>
                          <input placeholder="30" value={move.restSec} onChange={e => updateBuyOutMove(mi, 'restSec', e.target.value)} type="number" inputMode="numeric" style={{ width: 56, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 8px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>sec</span>
                        </>
                      ) : (
                        <>
                          <input placeholder="Reps or 15-12-9" value={move.reps} onChange={e => updateBuyOutMove(mi, 'reps', e.target.value)} style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                          <input placeholder="lbs" value={move.weight} onChange={e => updateBuyOutMove(mi, 'weight', e.target.value)} type="number" inputMode="decimal" style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, padding: '9px 10px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }} />
                        </>
                      )}
                    </div>
                    {!move.isRest && isLadder(move.reps) && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit', letterSpacing: 0.3 }}>
                          {parseLadder(move.reps).join(' → ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={addBuyOutMove} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer' }}>
                  + Add Movement
                </button>
              </>
            )}
          </div>
        )}

        {/* ── ACCESSORY ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px' }}>
          <span style={{ color: '#f5f0e8', fontSize: 18, fontWeight: 700, letterSpacing: -0.3, fontFamily: 'inherit' }}>Accessory</span>
          <button onClick={() => setHasAccessory(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit' }}>
            {hasAccessory ? 'Remove' : 'Add'}
          </button>
        </div>

        {hasAccessory && (
          <div style={{ padding: '0 20px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['Traditional', 'Tabata'].map(type => (
                <button key={type} onClick={() => setAccessoryType(type)} style={{ flexShrink: 0, backgroundColor: accessoryType === type ? 'rgba(15,247,197,0.14)' : 'rgba(255,255,255,0.07)', color: accessoryType === type ? '#0ff7c5' : 'rgba(245,240,232,0.5)', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: accessoryType === type ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {type}
                </button>
              ))}
            </div>

            {accessoryType === 'Traditional' && (
              <>
                {accessoryTraditionalMoves.map((move, mi) => (
                  <div key={mi} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px 14px 10px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input
                        placeholder={`Movement ${mi + 1}…`} value={move.name}
                        onChange={e => updateAccessoryTradMove(mi, 'name', e.target.value)}
                        style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 500, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none' }}
                      />
                      <button onClick={() => openPicker('accessoryTraditional', mi)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                        Library
                      </button>
                      {accessoryTraditionalMoves.length > 1 && (
                        <button onClick={() => removeAccessoryTradMove(mi)} style={{ backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 13, color: '#ff6b5e', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>×</button>
                      )}
                    </div>
                    <ImplementSelector
                      implement={move.implement}
                      singleArm={move.singleArm}
                      side={move.side}
                      onChange={({ implement, singleArm, side }) =>
                        setAccessoryTraditionalMoves(prev => prev.map((m, i) => i === mi ? { ...m, implement, singleArm, side } : m))
                      }
                    />
                    <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
                      <span style={{ width: 28, flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit', letterSpacing: 0.3 }}>REPS</span>
                      <span style={{ flex: 1.6, textAlign: 'center', fontSize: 11, color: 'rgba(245,240,232,0.3)', fontFamily: 'inherit', letterSpacing: 0.3 }}>WEIGHT</span>
                      <span style={{ width: 26, flexShrink: 0 }} /><span style={{ width: 26, flexShrink: 0 }} />
                    </div>
                    {move.sets.map((set, si) => (
                      <SetRow key={si} set={set} onChange={(f, v) => updateAccessoryTradSet(mi, si, f, v)} onDelete={() => deleteAccessoryTradSet(mi, si)} />
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => addAccessoryTradWarmupSet(mi)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, color: 'rgba(245,240,232,0.4)', fontFamily: 'inherit', cursor: 'pointer' }}>+ Warmup</button>
                      <button onClick={() => addAccessoryTradWorkingSet(mi)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer' }}>+ Set</button>
                    </div>
                  </div>
                ))}
                <button onClick={addAccessoryTradMove} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 4 }}>
                  + Add Movement
                </button>
              </>
            )}

            {accessoryType === 'Tabata' && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={labelStyle}>Work (sec)</p>
                    <input placeholder="20" value={accessoryTabataWork} onChange={e => setAccessoryTabataWork(e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={labelStyle}>Rest (sec)</p>
                    <input placeholder="10" value={accessoryTabataRest} onChange={e => setAccessoryTabataRest(e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                  </div>
                </div>
                {accessoryTabataMoves.map((move, mi) => (
                  <div key={mi} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input
                        placeholder={`Movement ${mi + 1}…`} value={move.name}
                        onChange={e => updateAccessoryTabataMove(mi, 'name', e.target.value)}
                        style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 500, color: '#f5f0e8', fontFamily: 'inherit', outline: 'none' }}
                      />
                      <button onClick={() => openPicker('accessoryTabata', mi)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'rgba(245,240,232,0.55)', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                        Library
                      </button>
                      {accessoryTabataMoves.length > 1 && (
                        <button onClick={() => removeAccessoryTabataMove(mi)} style={{ backgroundColor: 'rgba(255,59,48,0.12)', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 13, color: '#ff6b5e', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>×</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={labelStyle}>Rounds</p>
                        <input placeholder="8" value={move.rounds} onChange={e => updateAccessoryTabataMove(mi, 'rounds', e.target.value)} type="number" inputMode="numeric" style={inputBase} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={labelStyle}>Reps / 20s</p>
                        <input placeholder="15" value={move.reps} onChange={e => updateAccessoryTabataMove(mi, 'reps', e.target.value)} style={inputBase} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={labelStyle}>Weight (lbs)</p>
                        <input placeholder="35" value={move.weight} onChange={e => updateAccessoryTabataMove(mi, 'weight', e.target.value)} type="number" inputMode="decimal" style={inputBase} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addAccessoryTabataMove} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px', fontSize: 14, color: 'rgba(245,240,232,0.45)', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 4 }}>
                  + Add Movement
                </button>
              </>
            )}
          </div>
        )}

        {/* ── NOTES ── */}
        <div style={{ padding: '20px 20px 0' }}>
          <p style={labelStyle}>Notes</p>
          <textarea placeholder="How did it feel? Any mods?" value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={3} style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} />
        </div>

      </div>

      {/* ── LOG BUTTON (sticky footer) ── */}
      <div style={{
        position: 'sticky', bottom: 0,
        backgroundColor: '#120c18',
        padding: '12px 20px calc(env(safe-area-inset-bottom) + 16px)',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={handleLog} disabled={saving}
          style={{ width: '100%', backgroundColor: saving ? 'rgba(15,247,197,0.4)' : '#0ff7c5', color: '#0a0a0a', border: 'none', borderRadius: 14, padding: '18px 24px', fontSize: 17, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: -0.2 }}
        >
          {saving ? (initialSession ? 'Saving…' : 'Logging…') : (initialSession ? 'Save Changes' : 'Log Workout')}
        </button>
        {initialSession && (
          <button
            onClick={onClose}
            style={{ width: '100%', background: 'none', border: 'none', marginTop: 10, padding: '10px', fontSize: 15, color: 'rgba(245,240,232,0.4)', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
      </div>
    </>
  )
}
