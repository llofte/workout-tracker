import { useState, useEffect } from 'react'
import { supabase } from '../db/supabase'
import { useMovements } from '../hooks/useMovements'
import { toWorkoutDisplay } from '../utils/movements'

function formatReps(moveName, reps) {
  if (reps == null) return '—'
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

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  return `${weekday} · ${month} ${day}`
}

function isLadderReps(val) {
  if (!val) return false
  const parts = String(val).trim().replace(/\s+/g, '').split(/[-,]/)
  return parts.length >= 3 && parts.every(p => /^\d+$/.test(p) && Number(p) > 0)
}

function metconSubtitle(block) {
  const { format, duration, rounds, segments } = block
  const seg0 = segments?.[0]
  if (format === 'AMRAP') {
    const d = duration || seg0?.duration
    return d ? `${d} min AMRAP` : 'AMRAP'
  }
  if (format === 'OTM') {
    const iv = seg0?.interval || 1
    const label = iv === 1 ? 'EMOM' : `E${iv}MOM`
    if (segments?.length > 1) {
      const hasRest = segments.some((s, i) => i > 0 && s.restBefore)
      if (hasRest) {
        const total = segments.reduce((sum, s) => {
          const slots = [...new Set((s.movements ?? []).filter(m => !m.isRest && m.minuteAssignment != null).map(m => m.minuteAssignment))].length || 1
          return sum + (s.rounds || rounds || 0) * iv * slots
        }, 0)
        return `${total} min ${label}`
      }
      const r = rounds || seg0?.rounds
      return r ? `${r * segments.length * iv} min ${label}` : `${segments.length} min ${label}`
    }
    const r = rounds || seg0?.rounds
    if (r) return `${r * iv} min ${label}`
    const d = duration || seg0?.duration
    if (d) return `${d} min ${label}`
    return label
  }
  if (format === 'For Time' || format === 'Ladder') {
    const allMoves = [
      ...(segments?.flatMap(s => s.movements ?? []) ?? []),
      ...(block.movements ?? []),
    ].filter(m => !m.isRest)
    if (allMoves.some(m => isLadderReps(m.reps))) return 'Ladder'
    const r = rounds || seg0?.rounds
    if (Number(r) === 1) return 'Chipper'
    if (r) return `${r} Rounds For Time`
    return 'For Time'
  }
  if (format === 'Tabata') {
    const seg = segments?.[0]
    const work = seg?.work ?? 20
    const rest = seg?.rest ?? 10
    return `Tabata · ${work}s on / ${rest}s off`
  }
  return format || ''
}

function deriveSessionParts(session) {
  const hasStrength = !!session.strengthBlock
  const hasMetcon = !!session.metconBlock
  const hasAccessory = !!session.accessoryBlock

  if (session.title) {
    const raw = session.title.split(' / ').filter(Boolean)
    const mb = session.metconBlock
    const ladderOverride = mb && (mb.format === 'For Time' || mb.format === 'Ladder') && [
      ...(mb.segments?.flatMap(s => s.movements ?? []) ?? []),
      ...(mb.movements ?? []),
    ].filter(m => !m.isRest).some(m => isLadderReps(m.reps))
    if (raw.length >= 2) {
      const result = [`💪 ${raw[0]}`, `⚡ ${ladderOverride ? 'Ladder' : raw[1]}`]
      if (raw[2]) result.push(`⭐ ${raw[2]}`)
      else if (hasAccessory) result.push(`⭐ Accessory`)
      return result
    }
    if (raw.length === 1) {
      if (ladderOverride) return hasStrength ? [`💪 ${raw[0]}`, `⚡ Ladder`] : [`⚡ Ladder`]
      return [hasMetcon && !hasStrength ? `⚡ ${raw[0]}` : `💪 ${raw[0]}`]
    }
    return raw
  }

  const parts = []
  if (session.strengthBlock) {
    const names = (session.strengthBlock.movements || [])
      .map(m => m.name?.trim()).filter(Boolean).slice(0, 2)
    if (names.length) parts.push(`💪 ${names.join(' + ')}`)
  }
  if (session.metconBlock) {
    parts.push(`⚡ ${metconSubtitle(session.metconBlock)}`)
  }
  if (session.accessoryBlock) parts.push(`⭐ Accessory`)
  return parts.length ? parts : ['BB WOD']
}

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

const S = {
  sectionWrap: { padding: '24px 20px 10px' },
  sectionTitle: {
    color: '#0ff7c5', fontSize: 17, fontWeight: 700,
    letterSpacing: -0.2, margin: '0 0 3px', fontFamily: ff,
  },
  sectionSub: {
    color: 'rgba(245,240,232,0.45)', fontSize: 13,
    margin: 0, fontFamily: ff,
  },
  card: {
    backgroundColor: '#201a2a', borderRadius: 14,
    padding: '14px 16px', marginBottom: 10,
    border: '0.5px solid rgba(255,255,255,0.07)',
  },
  moveName: {
    color: '#f5f0e8', fontSize: 15, fontWeight: 600,
    margin: '0 0 10px', fontFamily: ff,
  },
  setNum: (isWarmup) => ({
    width: 28, flexShrink: 0, fontSize: 13, fontWeight: 600, fontFamily: ff,
    color: isWarmup ? 'rgba(245,240,232,0.28)' : 'rgba(245,240,232,0.45)',
  }),
  metaLine: {
    color: 'rgba(245,240,232,0.4)', fontSize: 12,
    margin: '0 0 10px', fontFamily: ff,
  },
}

function parseReps(reps) {
  if (typeof reps === 'number') return reps
  if (typeof reps === 'string') {
    const nums = reps.split(/[-,]/).map(Number).filter(n => Number.isFinite(n) && n > 0)
    return nums.length ? nums.reduce((a, b) => a + b, 0) : null
  }
  return null
}

function parseAmrapScore(score) {
  if (!score) return null
  const match = String(score).trim().match(/^(\d+)(?:\+(\d+))?$/)
  if (!match) return null
  return { completedRounds: parseInt(match[1], 10), extraReps: match[2] ? parseInt(match[2], 10) : 0 }
}

function calcPartialRoundVol(movements, extraReps) {
  let v = 0
  let remaining = extraReps
  for (const mv of movements) {
    if (remaining <= 0) break
    if (mv.isRest) continue
    const mvReps = parseReps(mv.reps) || 0
    const used = Math.min(mvReps, remaining)
    if (mv.weight && used > 0) v += used * mv.weight
    remaining -= mvReps
  }
  return v
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
  const amrapSeg = block.format === 'AMRAP' ? parseAmrapScore(block.score) : null
  for (const seg of block.segments ?? []) {
    if (amrapSeg) {
      for (const mv of seg.movements ?? []) {
        if (mv.isRest || !mv.weight) continue
        const reps = parseReps(mv.reps)
        if (reps) v += reps * mv.weight * amrapSeg.completedRounds
      }
      v += calcPartialRoundVol(seg.movements ?? [], amrapSeg.extraReps)
    } else {
      const r = seg.rounds || 1
      for (const mv of seg.movements ?? []) {
        if (mv.isRest || !mv.weight) continue
        const reps = parseReps(mv.reps)
        if (reps) v += reps * mv.weight * r
      }
    }
  }
  if (block.movements?.length) {
    const amrap = block.format === 'AMRAP' ? parseAmrapScore(block.score) : null
    if (amrap) {
      for (const mv of block.movements) {
        if (mv.isRest || !mv.weight) continue
        const reps = parseReps(mv.reps)
        if (reps) v += reps * mv.weight * amrap.completedRounds
      }
      v += calcPartialRoundVol(block.movements, amrap.extraReps)
    } else {
      let rounds = block.rounds || 1
      if (block.format === 'OTM' && block.duration && block.movements.some(mv => mv.minuteAssignment != null)) {
        const slots = new Set(
          block.movements.filter(mv => mv.minuteAssignment != null).map(mv => mv.minuteAssignment)
        ).size
        if (slots > 0) rounds = Math.floor(block.duration / slots)
      }
      for (const mv of block.movements) {
        if (mv.isRest || !mv.weight) continue
        const reps = parseReps(mv.reps)
        if (reps) v += reps * mv.weight * rounds
      }
    }
  }
  for (const mv of [...(block.buyIn ?? []), ...(block.buyOut ?? [])]) {
    if (mv.isRest || !mv.weight) continue
    const reps = parseReps(mv.reps)
    if (reps) v += reps * mv.weight
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

function SummaryBox({ score, vol }) {
  if (!score && !(vol > 0)) return null
  return (
    <div style={{
      ...S.card,
      backgroundColor: 'rgba(15,247,197,0.05)',
      border: '0.5px solid rgba(15,247,197,0.15)',
      padding: '10px 16px',
    }}>
      {score && <span style={{ color: '#0ff7c5', fontSize: 15, fontWeight: 600, fontFamily: ff }}>{score}</span>}
      {score && vol > 0 && <span style={{ color: '#ffffff', fontSize: 15, fontWeight: 400, fontFamily: ff }}> · </span>}
      {vol > 0 && <span style={{ color: '#0ff7c5', fontSize: 15, fontWeight: 600, fontFamily: ff }}>{vol.toLocaleString()} lbs</span>}
    </div>
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

  let workNum = 0
  return sets?.map((set, si) => {
    const isWarmup = set.notation === 'warmup'
    if (!isWarmup) workNum++
    const pr = prStatus(set)
    const repsText = set.reps != null ? `${set.reps} ${set.reps === 1 ? 'rep' : 'reps'}` : '—'
    const weightText = set.weight ? `${set.weight} lbs` : '—'
    return (
      <div key={si} style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '7px 0',
        borderBottom: si < sets.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <span style={S.setNum(isWarmup)}>{isWarmup ? 'W' : workNum}</span>
        <span style={{
          flex: 1, fontSize: 14, fontFamily: ff,
          color: isWarmup ? 'rgba(245,240,232,0.45)' : '#f5f0e8',
        }}>
          {repsText}
        </span>
        <span style={{
          minWidth: 72, textAlign: 'right', fontSize: 14, fontFamily: ff,
          color: isWarmup ? 'rgba(245,240,232,0.28)' : set.weight ? 'rgba(245,240,232,0.65)' : 'rgba(245,240,232,0.25)',
        }}>
          {weightText}
        </span>
        {pr === 'current' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#0ff7c5" stroke="none">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={{ color: '#0ff7c5', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, fontFamily: ff }}>PR</span>
          </div>
        )}
        {pr === 'former' && (
          <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, fontFamily: ff, flexShrink: 0, marginLeft: 4 }}>PR</span>
        )}
      </div>
    )
  })
}

function MetconMoveRow({ move, isOTM }) {
  if (move.isRest) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: ff }}>Rest</span>
        {!!move.restSeconds && (
          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: ff }}>{formatRestSeconds(move.restSeconds)}</span>
        )}
      </div>
    )
  }
  const repsText = formatReps(move.name, move.reps)
  const weightText = move.weight ? `${move.weight} lbs` : '—'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
      {isOTM && move.minuteAssignment != null && (
        <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, fontFamily: ff, width: 34, flexShrink: 0 }}>
          Min {move.minuteAssignment}
        </span>
      )}
      <span style={{ color: '#f5f0e8', fontSize: 14, fontWeight: 500, fontFamily: ff, flex: 1 }}>
        {toWorkoutDisplay(move)}
      </span>
      <span style={{ minWidth: 58, textAlign: 'right', color: 'rgba(245,240,232,0.5)', fontSize: 13, fontFamily: ff, flexShrink: 0 }}>
        {repsText}
      </span>
      <span style={{
        minWidth: 64, textAlign: 'right', fontSize: 13, fontFamily: ff, flexShrink: 0,
        color: move.weight ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.22)',
      }}>
        {weightText}
      </span>
    </div>
  )
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{ ...S.sectionWrap, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <p style={S.sectionTitle}>{title}</p>
        {subtitle && <p style={S.sectionSub}>{subtitle}</p>}
      </div>
      {right && <div style={{ paddingTop: 2 }}>{right}</div>}
    </div>
  )
}

function StrengthBlock({ block, allMovements }) {
  if (!block) return null
  const vol = calcStrengthVol(block)
  const subtitle = block.structure && block.structure !== 'Traditional' ? block.structure : null
  return (
    <>
      <SectionHeader title="Strength" subtitle={subtitle} />
      <div style={{ padding: '0 20px' }}>
        {block.movements?.map((move, i) => (
          <div key={i} style={S.card}>
            <p style={S.moveName}>{toWorkoutDisplay(move)}</p>
            <SetRows sets={move.sets} moveName={move.name} allMovements={allMovements} />
          </div>
        ))}
        <SummaryBox vol={vol} />
      </div>
    </>
  )
}

function MetconBlock({ block }) {
  if (!block) return null
  const isOTM = block.format === 'OTM'
  const vol = calcMetconVol(block)
  const subtitle = metconSubtitle(block)

  const segments = block.segments?.length
    ? block.segments
    : block.movements?.length
      ? [{ movements: block.movements, duration: block.duration, rounds: block.rounds }]
      : []

  return (
    <>
      <SectionHeader title="Metcon" />
      <div style={{ padding: '0 20px' }}>

        {block.buyIn?.length > 0 && (
          <div style={{ ...S.card, borderLeft: '2px solid rgba(245,240,232,0.12)' }}>
            <p style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px', fontFamily: ff }}>Buy In</p>
            {block.buyIn.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={false} />)}
          </div>
        )}

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
              {si === 0 && subtitle && (
                <p style={{ ...S.sectionSub, margin: '0 0 10px' }}>{subtitle}</p>
              )}
              {si > 0 && (seg.duration || seg.rounds) && (
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

        {block.buyOut?.length > 0 && (
          <div style={{ ...S.card, borderLeft: '2px solid rgba(245,240,232,0.12)' }}>
            <p style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px', fontFamily: ff }}>Buy Out</p>
            {block.buyOut.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={false} />)}
          </div>
        )}
        <SummaryBox score={block.score} vol={vol} />
      </div>
    </>
  )
}

function AccessoryBlock({ block }) {
  if (!block) return null
  const vol = calcAccessoryVol(block)
  return (
    <>
      <SectionHeader
        title="Accessory"
        subtitle={block.type && block.type !== 'Traditional' ? block.type : null}
      />
      <div style={{ padding: '0 20px' }}>
        {block.movements?.map((move, i) => (
          <div key={i} style={S.card}>
            <p style={S.moveName}>{toWorkoutDisplay(move)}</p>
            {block.type === 'Traditional' ? (
              <SetRows sets={move.sets} />
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ flex: 1, color: 'rgba(245,240,232,0.6)', fontSize: 14, fontFamily: ff }}>
                  {move.rounds ? `${move.rounds} rounds` : '8 rounds'}
                  {move.reps ? ` · ${move.reps} reps` : ''}
                </span>
                <span style={{
                  minWidth: 64, textAlign: 'right', fontSize: 14, fontFamily: ff,
                  color: move.weight ? 'rgba(245,240,232,0.65)' : 'rgba(245,240,232,0.22)',
                }}>
                  {move.weight ? `${move.weight} lbs` : '—'}
                </span>
              </div>
            )}
          </div>
        ))}
        <SummaryBox vol={vol} />
      </div>
    </>
  )
}

export default function SessionDetailScreen({ session, onBack, onEdit }) {
  const { strengthBlock, metconBlock, accessoryBlock, notes, date } = session
  const titleParts = deriveSessionParts(session)
  const allMovements = useMovements()
  const totalVol = calcStrengthVol(strengthBlock) + calcMetconVol(metconBlock) + calcAccessoryVol(accessoryBlock)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await supabase.from('sessions').delete().eq('id', session.id)
    onBack()
  }

  return (
    <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 85px)' }}>

      {/* Header */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff7c5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, fontFamily: ff, padding: 0, opacity: 0.8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <button onClick={() => onEdit(session)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.45)', fontSize: 14, fontFamily: ff, padding: 0 }}>
            Edit
          </button>
        </div>
        <p style={{ color: '#0ff7c5', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, margin: '0 0 8px', fontFamily: ff }}>
          {formatDate(date)}
        </p>
        {titleParts.map((part, i) => (
          <p key={i} style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.2, margin: i < titleParts.length - 1 ? '0 0 3px' : '0 0 8px', fontFamily: ff }}>
            {part}
          </p>
        ))}
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
          <div style={{ padding: '24px 20px 10px' }}>
            <p style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, margin: 0, fontFamily: ff }}>Notes</p>
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
