import { useState } from 'react'
import SessionDetailScreen from './SessionDetailScreen'
import { TAB_CLEARANCE } from '../utils/pwa'

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}


function sessionHasPR(session) {
  return session.strengthBlock?.movements?.some(m => m.sets?.some(s => s.isPR)) ?? false
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
    const { format, duration, rounds, segments } = session.metconBlock
    let label = format || 'Metcon'
    if (segments?.length > 1) {
      const totalWorkMin = segments.reduce((sum, s) => sum + (s.duration || 0), 0)
      const totalRestMin = segments.reduce((sum, s) => sum + (s.restBefore || 0) / 60, 0)
      const total = Math.round(totalWorkMin + totalRestMin)
      const firstDur = segments[0]?.duration
      const allSame = firstDur && segments.every(s => s.duration === firstDur)
      if (allSame) {
        label = `${firstDur} min ${format} ×${segments.length}`
      } else {
        label = `${total} min Metcon`
      }
    } else if (format === 'AMRAP' && duration) label = `${duration} min AMRAP`
    else if (format === 'OTM' && duration) label = `${duration} min OTM`
    else if (format === 'For Time' && rounds) label = `${rounds} Rounds For Time`
    parts.push(label)
  }

  return parts.join(' / ') || 'BB WOD'
}

function getSessionMoves(session) {
  const names = []

  for (const m of session.strengthBlock?.movements ?? []) {
    if (m.name?.trim()) names.push(m.name.trim())
  }

  const metcon = session.metconBlock
  if (metcon) {
    const segMoves = metcon.segments
      ? metcon.segments.flatMap(s => s.movements ?? [])
      : metcon.movements ?? []
    for (const m of segMoves) {
      if (!m.isRest && m.name?.trim()) names.push(m.name.trim())
    }
    for (const m of [...(metcon.buyIn ?? []), ...(metcon.buyOut ?? [])]) {
      if (!m.isRest && m.name?.trim()) names.push(m.name.trim())
    }
  }

  return [...new Set(names)]
}

function SessionCard({ session, onClick }) {
  const hasPR = sessionHasPR(session)
  const moves = getSessionMoves(session)

  return (
    <div onClick={onClick} style={{
      backgroundColor: '#2e2e2b',
      borderRadius: 14,
      padding: '13px 16px',
      margin: '0 20px 10px',
      cursor: 'pointer',
      border: '0.5px solid rgba(255,250,240,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13 }}>
          {formatDate(session.date)}
        </span>
        {hasPR && (
          <span style={{
            backgroundColor: 'rgba(148,100,230,0.22)',
            color: '#b898f0',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}>PR</span>
        )}
      </div>

      <p style={{ color: '#f5f0e8', fontSize: 15, fontWeight: 600, margin: '0 0 8px', fontFamily: 'inherit' }}>
        {deriveTitle(session)}
      </p>

      {moves.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {moves.slice(0, 6).map((name, i) => (
            <span key={i} style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              color: 'rgba(245,240,232,0.55)',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 12,
              fontFamily: 'inherit',
            }}>{name}</span>
          ))}
          {moves.length > 6 && (
            <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 12, fontFamily: 'inherit', alignSelf: 'center' }}>
              +{moves.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  root: { paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: TAB_CLEARANCE },
  header: { padding: '20px 20px 8px' },
  dateLabel: { color: 'rgba(245,240,232,0.5)', fontSize: 14, margin: '0 0 4px', fontWeight: 400 },
  title: { color: '#f5f0e8', fontSize: 20, fontWeight: 600, letterSpacing: -0.2, margin: 0, fontFamily: 'inherit' },
  ctaWrap: { padding: '16px 20px 8px' },
  cta: {
    width: '100%', backgroundColor: 'transparent', color: '#b898f0',
    border: '1.5px solid rgba(168,126,232,0.6)',
    borderRadius: 14, padding: '10px 16px', fontSize: 17, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontFamily: 'inherit', letterSpacing: -0.2,
  },
  sectionHeader: { padding: '16px 20px 8px' },
  sectionTitle: { color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: 0, fontFamily: 'inherit' },
  sectionLabel: { color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontFamily: 'inherit' },
  emptyCard: {
    margin: '0 20px', backgroundColor: '#2e2e2b', borderRadius: 14,
    padding: '36px 20px', textAlign: 'center',
    border: '0.5px solid rgba(255,250,240,0.06)',
  },
  emptyTitle: { color: '#f5f0e8', fontSize: 15, fontWeight: 600, margin: '0 0 6px', fontFamily: 'inherit' },
  emptyBody: { color: 'rgba(245,240,232,0.5)', fontSize: 14, margin: 0, lineHeight: 1.45, fontFamily: 'inherit' },
}

function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function getMonWeekStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function computeStats(sessions) {
  if (!sessions?.length) return { thisWeek: 0, weekStreak: 0 }

  const weekStart = getMonWeekStart(new Date())

  const thisWeek = sessions.filter(s =>
    new Date(s.date + 'T12:00:00') >= weekStart
  ).length

  const weekSet = new Set(sessions.map(s => {
    const ws = getMonWeekStart(new Date(s.date + 'T12:00:00'))
    return ws.toISOString().split('T')[0]
  }))

  let streak = 0
  const cursor = new Date(weekStart)
  // if current week is empty, start checking from last week
  if (!weekSet.has(cursor.toISOString().split('T')[0])) {
    cursor.setDate(cursor.getDate() - 7)
  }
  while (weekSet.has(cursor.toISOString().split('T')[0])) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }

  return { thisWeek, weekStreak: streak }
}

function monthLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function groupByMonth(sessions) {
  const groups = []
  for (const s of sessions) {
    const label = monthLabel(s.date)
    if (!groups.length || groups[groups.length - 1].label !== label) {
      groups.push({ label, sessions: [] })
    }
    groups[groups.length - 1].sessions.push(s)
  }
  return groups
}

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const hasApiKey = !!API_KEY && API_KEY !== 'your_key_here'

function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

function getLast8Mondays() {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() + (day === 0 ? -6 : 1 - day))
  mon.setHours(12, 0, 0, 0)
  const result = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(mon)
    d.setDate(mon.getDate() - i * 7)
    result.push(d.toISOString().split('T')[0])
  }
  return result
}

function weekBarLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sessionVolume(session) {
  let vol = 0
  for (const mv of session.strengthBlock?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps && s.weight) vol += s.reps * s.weight
    }
  }
  const mb = session.metconBlock
  if (mb) {
    for (const seg of mb.segments ?? []) {
      const rounds = seg.rounds || 1
      for (const mv of seg.movements ?? []) {
        if (mv.isRest || !mv.weight || typeof mv.reps !== 'number') continue
        vol += mv.reps * mv.weight * rounds
      }
    }
    for (const mv of [...(mb.movements ?? []), ...(mb.buyIn ?? []), ...(mb.buyOut ?? [])]) {
      if (mv.isRest || !mv.weight || typeof mv.reps !== 'number') continue
      vol += mv.reps * mv.weight
    }
  }
  for (const mv of session.accessoryBlock?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps && s.weight) vol += s.reps * s.weight
    }
  }
  return vol
}

const CHART_TABS = ['Frequency', 'Volume']

function WeeklyChart({ sessions }) {
  const [tab, setTab] = useState('Frequency')
  const mondays = getLast8Mondays()
  const counts = new Array(8).fill(0)
  const volumes = new Array(8).fill(0)

  for (const s of sessions) {
    const idx = mondays.indexOf(getMondayOf(s.date))
    if (idx === -1) continue
    counts[idx]++
    volumes[idx] += sessionVolume(s)
  }

  const values = tab === 'Frequency' ? counts : volumes
  const max = Math.max(...values, 1)

  function barLabel(v) {
    if (v === 0) return ''
    if (tab === 'Volume') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
    return String(v)
  }

  return (
    <div style={{ margin: '4px 20px 8px', backgroundColor: '#2e2e2b', borderRadius: 14, padding: '12px 14px 12px', border: '0.5px solid rgba(255,250,240,0.06)' }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
        {CHART_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '5px 11px', borderRadius: 20, border: 'none', cursor: 'pointer',
            backgroundColor: tab === t ? 'rgba(245,240,232,0.13)' : 'transparent',
            color: tab === t ? '#f5f0e8' : 'rgba(245,240,232,0.32)',
            fontSize: 12, fontWeight: tab === t ? 600 : 400, fontFamily: 'inherit',
          }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontSize: 9, lineHeight: 1, fontFamily: 'inherit',
              color: i === values.length - 1 ? 'rgba(245,240,232,0.6)' : 'rgba(245,240,232,0.28)',
            }}>
              {barLabel(v)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
        {values.map((v, i) => {
          const isCurrent = i === values.length - 1
          return (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: v > 0 ? `${Math.max((v / max) * 100, 8)}%` : 2,
                backgroundColor: isCurrent
                  ? (v > 0 ? '#a87ee8' : 'rgba(168,126,232,0.12)')
                  : (v > 0 ? 'rgba(245,240,232,0.22)' : 'rgba(245,240,232,0.06)'),
                borderRadius: '3px 3px 2px 2px',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {mondays.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              color: i === mondays.length - 1 ? 'rgba(245,240,232,0.5)' : 'rgba(245,240,232,0.2)',
              fontSize: 9, fontFamily: 'inherit', display: 'block',
            }}>
              {weekBarLabel(m)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildClaudeContext(sessions) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const recent = sessions.filter(s => s.date >= cutoffStr)
  const sorted = [...recent].sort((a, b) => b.date.localeCompare(a.date))
  return sorted.map(s => {
    const parts = []
    if (s.strengthBlock) {
      for (const mv of s.strengthBlock.movements ?? []) {
        const working = (mv.sets ?? []).filter(set => set.notation !== 'warmup')
        if (!working.length) continue
        const top = working.reduce((b, set) => (set.weight ?? 0) > (b.weight ?? 0) ? set : b, working[0])
        const pr = working.some(set => set.isPR) ? ' (PR)' : ''
        parts.push(`Strength: ${mv.name} — ${working.length} sets, top ${top.weight ?? '?'} lbs × ${top.reps ?? '?'} reps${pr}`)
      }
    }
    if (s.metconBlock) {
      const mb = s.metconBlock
      const mvNames = []
      for (const seg of mb.segments ?? []) {
        for (const mv of seg.movements ?? []) {
          if (!mv.isRest) mvNames.push(mv.name + (mv.reps ? ` ×${mv.reps}` : ''))
        }
      }
      for (const mv of mb.movements ?? []) {
        if (!mv.isRest) mvNames.push(mv.name + (mv.reps ? ` ×${mv.reps}` : ''))
      }
      const score = mb.score ? `, score: ${mb.score}` : ''
      parts.push(`Metcon: ${mb.format}${score} — ${mvNames.join(', ')}`)
    }
    return `${s.date}: ${parts.join(' | ') || 'No details'}`
  }).join('\n') || 'No sessions logged in the past 60 days.'
}

function AskClaude({ sessions }) {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function ask() {
    if (!question.trim() || loading) return
    setLoading(true)
    setResponse('')
    setError(null)
    try {
      const ctx = buildClaudeContext(sessions)
      const prompt = `You are a personal fitness assistant for a CrossFit/barbell athlete. Here is their workout log from the past 60 days:\n\n${ctx}\n\nThe athlete asks: "${question.trim()}"\n\nRespond conversationally in 2-4 sentences. Be specific and reference actual numbers when relevant. Keep it concise — this is a mobile app.`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              text += parsed.delta.text
              setResponse(text)
            }
          } catch {}
        }
      }
    } catch {
      setError('Could not reach Claude. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasResponse = response || error

  if (!hasApiKey) return (
    <div style={{ margin: '8px 20px 0', backgroundColor: '#2e2e2b', borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(255,250,240,0.06)' }}>
      <p style={{ color: 'rgba(245,240,232,0.3)', fontSize: 14, margin: 0, fontFamily: 'inherit' }}>
        Ask Claude requires an API key — add one to enable AI features.
      </p>
    </div>
  )

  return (
    <div style={{ margin: '8px 20px 0', backgroundColor: '#2e2e2b', borderRadius: 14, padding: '14px', border: '0.5px solid rgba(255,250,240,0.06)' }}>
      <style>{`@keyframes hs-spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
          placeholder="Ask about your training…"
          rows={2}
          style={{
            flex: 1, backgroundColor: '#2c2c2e', border: 'none', borderRadius: 10,
            padding: '10px 12px', fontSize: 15, color: '#f5f0e8', fontFamily: 'inherit',
            outline: 'none', resize: 'none', lineHeight: 1.4,
          }}
        />
        <button
          onClick={ask}
          disabled={!question.trim() || loading}
          style={{
            backgroundColor: question.trim() && !loading ? '#f5f0e8' : 'rgba(245,240,232,0.1)',
            color: question.trim() && !loading ? '#0a0a0a' : 'rgba(245,240,232,0.3)',
            border: 'none', borderRadius: 10, width: 42, height: 42,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: question.trim() && !loading ? 'pointer' : 'default', flexShrink: 0,
          }}
        >
          {loading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ animation: 'hs-spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      {hasResponse && (
        <div style={{ marginTop: 12, padding: '12px 14px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeft: '2px solid rgba(245,240,232,0.12)' }}>
          {error
            ? <p style={{ color: '#ff6b5e', fontSize: 14, margin: 0, fontFamily: 'inherit', lineHeight: 1.5 }}>{error}</p>
            : <p style={{ color: 'rgba(245,240,232,0.85)', fontSize: 14, margin: 0, fontFamily: 'inherit', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{response}</p>
          }
        </div>
      )}
      {hasResponse && !loading && (
        <button onClick={() => { setResponse(''); setError(null); setQuestion('') }}
          style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(245,240,232,0.3)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: '4px 0' }}>
          Clear
        </button>
      )}
    </div>
  )
}

const RECENT_LIMIT = 7

export default function HomeScreen({ sessions, onLogWorkout, onEdit }) {
  const [selectedSession, setSelectedSession] = useState(null)
  const [viewAll, setViewAll] = useState(false)
  const { thisWeek, weekStreak } = computeStats(sessions)

  const openSession = s => setSelectedSession(s)

  if (selectedSession) {
    return (
      <SessionDetailScreen
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        onEdit={session => { setSelectedSession(null); onEdit(session) }}
      />
    )
  }

  if (viewAll) {
    const groups = groupByMonth(sessions ?? [])
    return (
      <div style={S.root}>
        <div style={{ padding: '12px 20px 16px' }}>
          <button onClick={() => setViewAll(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.55)', fontSize: 15, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0, marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <h1 style={{ color: '#f5f0e8', fontSize: 28, fontWeight: 700, letterSpacing: -0.4, margin: 0, fontFamily: 'inherit' }}>All Workouts</h1>
        </div>
        {groups.map(group => (
          <div key={group.label}>
            <div style={{ padding: '8px 20px 6px' }}>
              <p style={S.sectionLabel}>{group.label}</p>
            </div>
            {group.sessions.map(s => (
              <SessionCard key={s.id} session={s} onClick={() => openSession(s)} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const recent = sessions?.slice(0, RECENT_LIMIT) ?? []

  return (
    <div style={S.root}>
      <div style={S.header}>
        <p style={S.dateLabel}>{today()}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={S.title}>LL Workouts</h1>
          <span style={{ backgroundColor: '#e05c4b', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 5px', letterSpacing: 0.3 }}>v13</span>
        </div>
        {sessions !== null && sessions.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <div>
              <span style={{ color: '#f5f0e8', fontSize: 22, fontWeight: 700, fontFamily: 'inherit', letterSpacing: -0.3 }}>{thisWeek}</span>
              <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit', marginLeft: 5 }}>this week</span>
            </div>
            {weekStreak > 1 && (
              <div>
                <span style={{ color: '#f5f0e8', fontSize: 22, fontWeight: 700, fontFamily: 'inherit', letterSpacing: -0.3 }}>{weekStreak}</span>
                <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, fontFamily: 'inherit', marginLeft: 5 }}>week streak</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={S.ctaWrap}>
        <button style={S.cta} onClick={onLogWorkout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b898f0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log Workout
        </button>
      </div>

      <WeeklyChart sessions={sessions ?? []} />

      <div style={{ ...S.sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={S.sectionTitle}>Recent</h2>
        {sessions?.length > RECENT_LIMIT && (
          <button onClick={() => setViewAll(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.45)', fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
            View All
          </button>
        )}
      </div>

      {sessions === null && null}

      {sessions !== null && sessions.length === 0 && (
        <div style={S.emptyCard}>
          <p style={S.emptyTitle}>No workouts yet</p>
          <p style={S.emptyBody}>Tap Log Workout to record your first session.</p>
        </div>
      )}

      {sessions !== null && recent.map(s => (
        <SessionCard key={s.id} session={s} onClick={() => openSession(s)} />
      ))}

      <div style={{ padding: '16px 20px 8px' }}>
        <p style={S.sectionLabel}>Ask Claude</p>
      </div>
      <AskClaude sessions={sessions ?? []} />
    </div>
  )
}
