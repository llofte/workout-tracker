import { useState, useEffect } from 'react'
import { supabase } from '../db/supabase'
import { useMovements } from '../hooks/useMovements'

function formatReps(moveName, reps) {
  if (reps == null) return ''
  const s = String(reps)
  if (/[a-zA-Z]/.test(s)) return s
  if (/\brow\b|rowing|\bbike\b|cycling|ski\s*erg|assault/i.test(moveName ?? '')) return `${s} cal`
  const n = Number(s)
  return isNaN(n) ? s : `${n} ${n === 1 ? 'rep' : 'reps'}`
}

function formatRestSeconds(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m && s) return `${m}m ${s}s`
  if (m) return `${m} min`
  return `${s}s`
}

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

const S = {
  sectionWrap: { padding: '20px 20px 8px' },
  sectionLabel: {
    color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontFamily: ff,
  },
  card: {
    backgroundColor: '#1c1c1e', borderRadius: 14,
    padding: '14px 16px', marginBottom: 10,
  },
  moveName: {
    color: '#f5f0e8', fontSize: 15, fontWeight: 600,
    margin: '0 0 10px', fontFamily: ff,
  },
  setNum: (isWarmup) => ({
    width: 28, flexShrink: 0, fontSize: 13, fontWeight: 600, fontFamily: ff,
    color: isWarmup ? 'rgba(245,240,232,0.28)' : 'rgba(245,240,232,0.45)',
  }),
  setLabel: (isWarmup) => ({
    fontSize: 14, fontFamily: ff,
    color: isWarmup ? 'rgba(245,240,232,0.45)' : '#f5f0e8',
  }),
  metaLine: {
    color: 'rgba(245,240,232,0.4)', fontSize: 12,
    margin: '0 0 10px', fontFamily: ff,
  },
}

function calcStrengthVol(block) {
  let v = 0
  for (const mv of block?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps && s.weight) v += s.reps * s.weight
    }
  }
  return v
}

function calcMetconVol(block) {
  if (!block) return 0
  let v = 0
  for (const seg of block.segments ?? []) {
    const r = seg.rounds || 1
    for (const mv of seg.movements ?? []) {
      if (mv.isRest || !mv.weight || typeof mv.reps !== 'number') continue
      v += mv.reps * mv.weight * r
    }
  }
  for (const mv of [...(block.movements ?? []), ...(block.buyIn ?? []), ...(block.buyOut ?? [])]) {
    if (mv.isRest || !mv.weight || typeof mv.reps !== 'number') continue
    v += mv.reps * mv.weight
  }
  return v
}

function calcAccessoryVol(block) {
  let v = 0
  for (const mv of block?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps && s.weight) v += s.reps * s.weight
    }
  }
  return v
}

function VolLabel({ vol }) {
  if (!vol) return null
  return (
    <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 12, fontFamily: ff }}>
      {vol.toLocaleString()} lbs
    </span>
  )
}

function SetRows({ sets, moveName, allMovements }) {
  function prStatus(set) {
    if (!set.isPR) return null
    const record = allMovements?.find(m => m.name === moveName)
    const best = record?.prs
      ?.filter(p => p.reps === set.reps)
      ?.reduce((b, p) => p.weight > (b?.weight ?? -1) ? p : b, null)
    if (!best || set.weight >= best.weight) return 'current'
    return 'former'
  }

  return sets?.map((set, si) => {
    const isWarmup = set.notation === 'warmup'
    const pr = prStatus(set)
    return (
      <div key={si} style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '6px 0',
        borderBottom: si < sets.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <span style={S.setNum(isWarmup)}>{isWarmup ? 'W' : set.setNumber}</span>
        <span style={S.setLabel(isWarmup)}>
          {set.reps != null ? `${set.reps} ${set.reps === 1 ? 'rep' : 'reps'}` : '—'}
          {set.weight ? ` · ${set.weight} lbs` : ''}
        </span>
        {pr === 'current' && (
          <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(192,57,43,0.22)', color: '#e05c4b', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700, letterSpacing: 0.3, fontFamily: ff, flexShrink: 0 }}>PR</span>
        )}
        {pr === 'former' && (
          <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(245,240,232,0.3)', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700, letterSpacing: 0.3, fontFamily: ff, flexShrink: 0 }}>PR</span>
        )}
      </div>
    )
  })
}

function MetconMoveRow({ move, isOTM }) {
  if (move.isRest) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
        <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: ff }}>Rest</span>
        {!!move.restSeconds && (
          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: ff }}>{formatRestSeconds(move.restSeconds)}</span>
        )}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
      {isOTM && move.minuteAssignment != null && (
        <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, fontFamily: ff, width: 34, flexShrink: 0 }}>
          Min {move.minuteAssignment}
        </span>
      )}
      <span style={{ color: '#f5f0e8', fontSize: 14, fontWeight: 500, fontFamily: ff, flex: 1 }}>
        {move.name || '—'}
      </span>
      <span style={{ color: 'rgba(245,240,232,0.5)', fontSize: 13, fontFamily: ff, flexShrink: 0 }}>
        {[move.reps != null ? formatReps(move.name, move.reps) : '', move.weight ? `${move.weight} lbs` : ''].filter(Boolean).join(' · ')}
      </span>
    </div>
  )
}

function MovesCard({ moves, isOTM }) {
  if (!moves?.length) return null
  return (
    <div style={S.card}>
      {moves.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={isOTM} />)}
    </div>
  )
}

function StrengthBlock({ block, allMovements }) {
  if (!block) return null
  const vol = calcStrengthVol(block)
  return (
    <>
      <div style={{ ...S.sectionWrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={S.sectionLabel}>Strength</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VolLabel vol={vol} />
          {block.structure && (
            <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, fontFamily: ff }}>{block.structure}</span>
          )}
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        {block.movements?.map((move, i) => (
          <div key={i} style={S.card}>
            <p style={S.moveName}>{move.name || '—'}</p>
            <SetRows sets={move.sets} moveName={move.name} allMovements={allMovements} />
          </div>
        ))}
      </div>
    </>
  )
}

function MetconBlock({ block }) {
  if (!block) return null
  const isOTM = block.format === 'OTM'
  const vol = calcMetconVol(block)

  // Support both old format (direct movements[]) and new format (segments[])
  const segments = block.segments?.length
    ? block.segments
    : block.movements?.length
      ? [{ movements: block.movements, duration: block.duration, rounds: block.rounds }]
      : []

  return (
    <>
      <div style={{ ...S.sectionWrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={S.sectionLabel}>Metcon · {block.format}</p>
        <VolLabel vol={vol} />
      </div>
      <div style={{ padding: '0 20px' }}>

        {/* Buy In */}
        {block.buyIn?.length > 0 && (
          <div style={{ ...S.card, borderLeft: '2px solid rgba(245,240,232,0.12)' }}>
            <p style={{ ...S.sectionLabel, margin: '0 0 8px' }}>Buy In</p>
            {block.buyIn.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={false} />)}
          </div>
        )}

        {/* Segments */}
        {segments.map((seg, si) => (
          <div key={si}>
            {si > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
                <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
                {seg.restBefore != null && (
                  <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, fontFamily: ff }}>
                    Rest {formatRestSeconds(seg.restBefore)}
                  </span>
                )}
                <div style={{ flex: 1, height: '0.5px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
              </div>
            )}
            <div style={S.card}>
              {(seg.duration || seg.rounds) && (
                <p style={S.metaLine}>
                  {[
                    seg.duration ? `${seg.duration} min` : '',
                    seg.rounds ? `${seg.rounds} rounds` : '',
                    isOTM && seg.interval ? `every ${seg.interval} min` : '',
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
              {seg.movements?.map((m, mi) => <MetconMoveRow key={mi} move={m} isOTM={isOTM} />)}
            </div>
          </div>
        ))}

        {/* Score */}
        {block.score && (
          <div style={{ ...S.card, backgroundColor: 'rgba(245,240,232,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...S.sectionLabel, margin: 0 }}>Score</span>
            <span style={{ color: '#f5f0e8', fontSize: 18, fontWeight: 700, fontFamily: ff }}>{block.score}</span>
          </div>
        )}

        {/* Buy Out */}
        {block.buyOut?.length > 0 && (
          <div style={{ ...S.card, borderLeft: '2px solid rgba(245,240,232,0.12)' }}>
            <p style={{ ...S.sectionLabel, margin: '0 0 8px' }}>Buy Out</p>
            {block.buyOut.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={false} />)}
          </div>
        )}
      </div>
    </>
  )
}

function AccessoryBlock({ block }) {
  if (!block) return null
  const vol = calcAccessoryVol(block)
  return (
    <>
      <div style={{ ...S.sectionWrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={S.sectionLabel}>Accessory</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VolLabel vol={vol} />
          {block.type && <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, fontFamily: ff }}>{block.type}</span>}
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        {block.movements?.map((move, i) => (
          <div key={i} style={S.card}>
            <p style={S.moveName}>{move.name || '—'}</p>
            {block.type === 'Traditional' ? (
              <SetRows sets={move.sets} />
            ) : (
              <span style={{ color: 'rgba(245,240,232,0.5)', fontSize: 13, fontFamily: ff }}>
                {[
                  move.rounds ? `${move.rounds} rounds` : '8 rounds',
                  move.reps ? `${move.reps} reps` : '',
                  move.weight ? `${move.weight} lbs` : '',
                ].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function deriveTitle(session) {
  if (session.title) return session.title
  const parts = []
  if (session.strengthBlock) {
    const names = (session.strengthBlock.movements || [])
      .map(m => m.name?.trim()).filter(Boolean).slice(0, 2)
    if (names.length) parts.push(names.join(' + '))
  }
  if (session.metconBlock) {
    const { format, duration, rounds } = session.metconBlock
    let label = format || 'Metcon'
    if (format === 'AMRAP' && duration) label = `${duration} min AMRAP`
    else if (format === 'OTM' && duration) label = `${duration} min OTM`
    else if (format === 'For Time' && rounds) label = `${rounds} Rounds For Time`
    parts.push(label)
  }
  return parts.join(' / ') || 'BB WOD'
}

export default function SessionDetailScreen({ session, onBack, onEdit }) {
  const { strengthBlock, metconBlock, accessoryBlock, notes, date } = session
  const title = deriveTitle(session)
  const allMovements = useMovements()
  const totalVol = calcStrengthVol(strengthBlock) + calcMetconVol(metconBlock) + calcAccessoryVol(accessoryBlock)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0)
  }, [])

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await supabase.from('sessions').delete().eq('id', session.id)
    onBack()
  }

  return (
    <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.55)', fontSize: 15, display: 'flex', alignItems: 'center', gap: 4, fontFamily: ff, padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <button onClick={() => onEdit(session)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.55)', fontSize: 15, fontFamily: ff, padding: 0 }}>
            Edit
          </button>
        </div>
        <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: 14, margin: '0 0 4px', fontFamily: ff }}>
          {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 style={{ color: '#f5f0e8', fontSize: 28, fontWeight: 700, letterSpacing: -0.4, margin: '0 0 6px', fontFamily: ff }}>
          {title}
        </h1>
        {totalVol > 0 && (
          <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, margin: 0, fontFamily: ff }}>
            {totalVol.toLocaleString()} lbs total volume
          </p>
        )}
      </div>

      <StrengthBlock block={strengthBlock} allMovements={allMovements} />
      <MetconBlock block={metconBlock} />
      <AccessoryBlock block={accessoryBlock} />

      {notes ? (
        <>
          <div style={S.sectionWrap}>
            <p style={S.sectionLabel}>Notes</p>
          </div>
          <div style={{ padding: '0 20px' }}>
            <div style={S.card}>
              <p style={{ color: 'rgba(245,240,232,0.7)', fontSize: 14, margin: 0, lineHeight: 1.5, fontFamily: ff }}>{notes}</p>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ padding: '24px 20px 8px' }}>
        <button
          onClick={handleDelete}
          style={{
            width: '100%', backgroundColor: confirmDelete ? 'rgba(255,59,48,0.18)' : 'rgba(255,255,255,0.04)',
            color: confirmDelete ? '#ff6b5e' : 'rgba(245,240,232,0.35)',
            border: `1px solid ${confirmDelete ? 'rgba(255,59,48,0.35)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: ff,
          }}
        >
          {confirmDelete ? 'Tap again to confirm delete' : 'Delete Workout'}
        </button>
      </div>

    </div>
  )
}
