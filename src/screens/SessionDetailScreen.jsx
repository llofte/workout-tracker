import { useState, useEffect } from 'react'
import { supabase } from '../db/supabase'
import { useMovements } from '../hooks/useMovements'
import { toWorkoutDisplay } from '../utils/movements'

const CARDIO_RE = /\brow\b|rowing|\bbike\b|cycling|ski\s*erg|assault|\brun\b|running/i

function formatReps(moveName, reps, cardioUnit) {
  if (reps == null) return '—'
  const s = String(reps)
  if (/[a-zA-Z]/.test(s)) return s
  if (CARDIO_RE.test(moveName ?? '')) {
    if (cardioUnit === 'm') return `${s} m`
    if (cardioUnit === 'mi') return `${s} mi`
    if (cardioUnit === 'sec') return `${s} sec`
    return `${s} cal`
  }
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

function formatScore(score) {
  if (!score) return null
  const s = String(score).trim()
  const timeMatch = s.match(/^(\d+):(\d{2})$/)
  if (timeMatch) {
    const min = parseInt(timeMatch[1], 10)
    const sec = parseInt(timeMatch[2], 10)
    if (min && sec) return `${min} min ${sec} sec`
    if (min) return `${min} min`
    return `${sec} sec`
  }
  const amrap = parseAmrapScore(s)
  if (!amrap) return s
  const roundsPart = `${amrap.completedRounds} ${amrap.completedRounds === 1 ? 'round' : 'rounds'}`
  if (!amrap.extraReps) return roundsPart
  return `${roundsPart} + ${amrap.extraReps} ${amrap.extraReps === 1 ? 'rep' : 'reps'}`
}

function SummaryBox({ score, vol }) {
  if (!score && !(vol > 0)) return null
  const displayScore = score ? formatScore(score) : null
  return (
    <div style={{
      ...S.card,
      backgroundColor: 'rgba(15,247,197,0.05)',
      border: '0.5px solid rgba(15,247,197,0.15)',
      padding: '10px 16px',
    }}>
      {displayScore && <span style={{ color: '#0ff7c5', fontSize: 15, fontWeight: 600, fontFamily: ff }}>{displayScore}</span>}
      {score && vol > 0 && <span style={{ color: '#ffffff', fontSize: 20, fontWeight: 400, fontFamily: ff }}> · </span>}
      {vol > 0 && <span style={{ color: '#0ff7c5', fontSize: 15, fontWeight: 600, fontFamily: ff }}>{vol.toLocaleString()} lbs</span>}
    </div>
  )
}

function SetRows({ sets, moveName, allMovements, inlineLayout }) {
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
        padding: inlineLayout ? '8px 16px' : '7px 0',
        borderBottom: inlineLayout
          ? '0.5px solid rgba(255,255,255,0.05)'
          : si < sets.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}>
        <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: ff }}>Rest</span>
        {!!move.restSeconds && (
          <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: ff }}>{formatRestSeconds(move.restSeconds)}</span>
        )}
      </div>
    )
  }
  const repsText = formatReps(move.name, move.reps, move.cardioUnit)
  const weightText = move.weight ? `${move.weight} lbs` : '—'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
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
  return (
    <div style={{ padding: '0 20px' }}>
      {block.movements?.map((move, i) => {
        const moveVol = (move.sets ?? []).reduce((sum, s) => {
          if (s.notation === 'warmup') return sum
          return s.reps && s.weight ? sum + s.reps * s.weight : sum
        }, 0)
        return (
          <div key={i} style={{
            backgroundColor: '#201a2a', borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden',
            marginBottom: i < (block.movements?.length ?? 1) - 1 ? 12 : 0,
          }}>
            <div style={{ padding: '14px 16px 8px' }}>
              <p style={{ color: 'rgba(15,247,197,0.5)', fontSize: 17, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 3px', fontFamily: ff }}>Strength</p>
              <p style={{ color: 'rgba(245,240,232,0.55)', fontSize: 16, fontWeight: 500, margin: 0, fontFamily: ff }}>{toWorkoutDisplay(move)}</p>
            </div>
            <SetRows sets={move.sets} moveName={move.name} allMovements={allMovements} inlineLayout />
            {moveVol > 0 && (
              <div style={{ background: '#131820', padding: '11px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ color: 'rgba(245,240,232,0.5)', fontSize: 16, fontWeight: 600, fontFamily: ff }}>
                  {moveVol.toLocaleString()} lbs
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function segmentLabel(seg, block) {
  if (block.format === 'OTM') {
    const iv = seg.interval || 1
    const label = iv === 1 ? 'EMOM' : `E${iv}MOM`
    return seg.rounds ? `${seg.rounds} Rounds · ${label}` : label
  }
  if (seg.rounds) return `${seg.rounds} Rounds`
  if (seg.duration) return `${seg.duration} min`
  return ''
}

function MetconBlock({ block }) {
  if (!block) return null
  const isOTM = block.format === 'OTM'
  const vol = calcMetconVol(block)
  const subtitle = metconSubtitle(block)
  const displayScore = block.score ? formatScore(block.score) : null

  const segments = block.segments?.length
    ? block.segments
    : block.movements?.length
      ? [{ movements: block.movements, duration: block.duration, rounds: block.rounds }]
      : []

  const isMultiSeg = segments.length > 1

  return (
    <div style={{ padding: '22px 20px 0' }}>
      <div style={{ backgroundColor: '#201a2a', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        <div style={{ padding: '14px 16px 8px' }}>
          <p style={{ color: 'rgba(15,247,197,0.5)', fontSize: 17, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 3px', fontFamily: ff }}>Metcon</p>
          <p style={{ color: 'rgba(245,240,232,0.55)', fontSize: 16, fontWeight: 500, margin: 0, fontFamily: ff }}>{subtitle}</p>
        </div>

        {block.buyIn?.length > 0 && (
          <>
            <div style={{ padding: '4px 16px 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(245,240,232,0.28)', fontFamily: ff }}>Buy In</span>
            </div>
            {block.buyIn.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={false} />)}
          </>
        )}

        {segments.map((seg, si) => (
          <div key={si}>
            {si > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(245,240,232,0.1)' }} />
                {seg.restBefore != null && (
                  <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 11, fontWeight: 600, letterSpacing: 0.4, fontFamily: ff, whiteSpace: 'nowrap' }}>
                    {formatRestSeconds(seg.restBefore)} rest
                  </span>
                )}
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(245,240,232,0.1)' }} />
              </div>
            )}
            {isMultiSeg && (
              <div style={{ padding: '4px 16px 2px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(245,240,232,0.28)', fontFamily: ff }}>
                  {segmentLabel(seg, block)}
                </span>
              </div>
            )}
            {seg.movements?.map((m, mi) => <MetconMoveRow key={mi} move={m} isOTM={isOTM} />)}
          </div>
        ))}

        {block.buyOut?.length > 0 && (
          <>
            <div style={{ padding: '8px 16px 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(245,240,232,0.28)', fontFamily: ff }}>Buy Out</span>
            </div>
            {block.buyOut.map((m, i) => <MetconMoveRow key={i} move={m} isOTM={false} />)}
          </>
        )}

        {(displayScore || vol > 0) && (
          <div style={{ background: '#131820', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {displayScore
              ? <span style={{ color: '#0ff7c5', fontSize: 16, fontWeight: 600, flex: 1, fontFamily: ff }}>{displayScore}</span>
              : <span style={{ flex: 1 }} />
            }
            {vol > 0 && (
              <span style={{ textAlign: 'right', color: 'rgba(245,240,232,0.5)', fontSize: 16, fontWeight: 600, fontFamily: ff }}>
                {vol.toLocaleString()} lbs
              </span>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function AccessoryBlock({ block }) {
  if (!block) return null
  const isTraditional = !block.type || block.type === 'Traditional'
  return (
    <div style={{ padding: '22px 20px 0' }}>
      {block.movements?.map((move, i) => {
        const moveVol = isTraditional
          ? (move.sets ?? []).reduce((sum, s) => {
              if (s.notation === 'warmup') return sum
              return s.reps && s.weight ? sum + s.reps * s.weight : sum
            }, 0)
          : (move.weight && move.reps ? move.weight * Number(move.reps) * (move.rounds || 8) : 0)
        return (
          <div key={i} style={{
            backgroundColor: '#201a2a', borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden',
            marginBottom: i < (block.movements?.length ?? 1) - 1 ? 12 : 0,
          }}>
            <div style={{ padding: '14px 16px 8px' }}>
              <p style={{ color: 'rgba(15,247,197,0.5)', fontSize: 17, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 3px', fontFamily: ff }}>Accessory</p>
              <p style={{ color: 'rgba(245,240,232,0.55)', fontSize: 16, fontWeight: 500, margin: 0, fontFamily: ff }}>{toWorkoutDisplay(move)}</p>
            </div>
            {isTraditional ? (
              <SetRows sets={move.sets} moveName={move.name} inlineLayout />
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                <span style={{ flex: 1, color: 'rgba(245,240,232,0.6)', fontSize: 14, fontFamily: ff }}>
                  {move.rounds ? `${move.rounds} rounds` : '8 rounds'}
                  {move.reps ? ` · ${move.reps} reps` : ''}
                </span>
                <span style={{ minWidth: 64, textAlign: 'right', fontSize: 14, fontFamily: ff, color: move.weight ? 'rgba(245,240,232,0.65)' : 'rgba(245,240,232,0.22)' }}>
                  {move.weight ? `${move.weight} lbs` : '—'}
                </span>
              </div>
            )}
            {moveVol > 0 && (
              <div style={{ background: '#131820', padding: '11px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ color: 'rgba(245,240,232,0.5)', fontSize: 16, fontWeight: 600, fontFamily: ff }}>
                  {moveVol.toLocaleString()} lbs
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
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
        <p style={{ color: '#0ff7c5', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, margin: '0 0 14px', fontFamily: ff }}>
          {formatDate(date)}
        </p>
        {titleParts.map((part, i) => (
          <p key={i} style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.2, margin: i < titleParts.length - 1 ? '0 0 3px' : '0 0 12px', fontFamily: ff }}>
            {part}
          </p>
        ))}
        {totalVol > 0 && (
          <p style={{ color: '#0ff7c5', fontSize: 22, fontWeight: 800, letterSpacing: -0.3, margin: 0, fontFamily: ff }}>
            {totalVol.toLocaleString()} lbs
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
