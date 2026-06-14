import { useState, useEffect } from 'react'
import { db } from '../db/db'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const sectionLabel = {
  color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontFamily: ff,
}

// --- Week helpers ---

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

function weekLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- Data ---

function sessionVolume(session) {
  let vol = 0
  for (const mv of session.strengthBlock?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps && s.weight) vol += s.reps * s.weight
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

function sessionReps(session) {
  let total = 0
  for (const mv of session.strengthBlock?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps) total += s.reps
    }
  }
  for (const mv of session.accessoryBlock?.movements ?? []) {
    for (const s of mv.sets ?? []) {
      if (s.notation === 'warmup') continue
      if (s.reps) total += s.reps
    }
  }
  return total
}

function buildWeekStats(sessions) {
  const mondays = getLast8Mondays()
  const volume = new Array(8).fill(0)
  const count = new Array(8).fill(0)
  const reps = new Array(8).fill(0)
  for (const s of sessions) {
    const idx = mondays.indexOf(getMondayOf(s.date))
    if (idx === -1) continue
    count[idx]++
    volume[idx] += sessionVolume(s)
    reps[idx] += sessionReps(s)
  }
  return { mondays, volume, count, reps }
}

function buildClaudeContext(sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
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
  }).join('\n')
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PR_BOARD = [
  { label: 'Squat',        search: ['Back Squat', 'Squat'] },
  { label: 'Front Squat',  search: ['Front Squat'] },
  { label: 'Snatch',       search: ['Snatch'] },
  { label: 'Power Snatch', search: ['Power Snatch'] },
  { label: 'Clean',        search: ['Clean'] },
  { label: 'Power Clean',  search: ['Power Clean'] },
  { label: 'Clean & Jerk', search: ['Clean & Jerk', 'C&J'] },
  { label: 'Deadlift',     search: ['Deadlift'] },
]

// --- Bar chart ---

function BarChart({ values, labels, barColor = '#f5f0e8', chartHeight = 80 }) {
  const max = Math.max(...values, 1)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: chartHeight }}>
        {values.map((v, i) => {
          const isCurrent = i === values.length - 1
          const pct = (v / max) * 100
          return (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: v > 0 ? `${Math.max(pct, 4)}%` : 2,
                backgroundColor: isCurrent
                  ? (v > 0 ? barColor : 'rgba(245,240,232,0.1)')
                  : (v > 0 ? 'rgba(245,240,232,0.2)' : 'rgba(245,240,232,0.06)'),
                borderRadius: '3px 3px 2px 2px',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
        {labels.map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              color: i === labels.length - 1 ? 'rgba(245,240,232,0.5)' : 'rgba(245,240,232,0.22)',
              fontSize: 9,
              fontFamily: ff,
              display: 'block',
              lineHeight: 1.2,
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Ask Claude ---

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
      const ctx = sessions?.length
        ? buildClaudeContext(sessions)
        : 'No sessions logged in the past 60 days.'
      const prompt = `You are a personal fitness assistant for a CrossFit/barbell athlete. Here is their workout log from the past 60 days:\n\n${ctx}\n\nThe athlete asks: "${question.trim()}"\n\nRespond conversationally in 2-4 sentences. Be specific and reference actual numbers from their data when relevant. Keep it concise — this renders in a mobile app.`

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
    } catch (e) {
      setError('Could not reach Claude. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setResponse('')
    setError(null)
    setQuestion('')
  }

  const hasResponse = response || error

  return (
    <div style={{ margin: '0 20px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '16px' }}>
      <style>{`@keyframes wt-spin { to { transform: rotate(360deg) } }`}</style>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
          placeholder="Ask about your training…"
          rows={2}
          style={{
            flex: 1, backgroundColor: '#2c2c2e', border: 'none', borderRadius: 10,
            padding: '10px 12px', fontSize: 15, color: '#f5f0e8', fontFamily: ff,
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
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ animation: 'wt-spin 1s linear infinite' }}
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Response */}
      {hasResponse && (
        <div style={{ marginTop: 14, padding: '14px 14px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeft: '2px solid rgba(245,240,232,0.12)' }}>
          {error ? (
            <p style={{ color: '#ff6b5e', fontSize: 14, margin: 0, fontFamily: ff, lineHeight: 1.5 }}>{error}</p>
          ) : (
            <p style={{ color: 'rgba(245,240,232,0.85)', fontSize: 14, margin: 0, fontFamily: ff, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{response}</p>
          )}
        </div>
      )}

      {hasResponse && !loading && (
        <button onClick={clear} style={{
          marginTop: 10, background: 'none', border: 'none',
          color: 'rgba(245,240,232,0.3)', fontSize: 13, fontFamily: ff, cursor: 'pointer', padding: '4px 0',
        }}>
          Clear
        </button>
      )}
    </div>
  )
}

// --- Main screen ---

export default function TrendsScreen() {
  const [sessions, setSessions] = useState(null)
  const [movements, setMovements] = useState(null)

  useEffect(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    db.sessions.where('date').aboveOrEqual(cutoffStr).toArray().then(setSessions)
    db.movements.toArray().then(setMovements)
  }, [])

  function get1RM(searchNames) {
    if (!movements) return null
    const matches = movements.filter(m =>
      searchNames.some(n => m.name.toLowerCase() === n.toLowerCase())
    )
    let best = null
    for (const m of matches) {
      for (const pr of m.prs ?? []) {
        if (pr.reps === 1 && pr.weight != null) {
          if (!best || pr.weight > best.weight) best = pr
        }
      }
    }
    return best
  }

  const weekStats = sessions ? buildWeekStats(sessions) : null
  const labels = weekStats ? weekStats.mondays.map(weekLabel) : []

  const thisWeekVol = weekStats?.volume[7] ?? 0
  const lastWeekVol = weekStats?.volume[6] ?? 0
  const thisWeekReps = weekStats?.reps[7] ?? 0
  const lastWeekReps = weekStats?.reps[6] ?? 0

  function volDiffLabel() {
    if (lastWeekVol === 0 || thisWeekVol === 0) return null
    const pct = Math.round(((thisWeekVol - lastWeekVol) / lastWeekVol) * 100)
    if (pct === 0) return 'same as last week'
    return `${pct > 0 ? '+' : ''}${pct}% vs last week`
  }

  return (
    <div style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 60 }}>
      <div style={{ padding: '20px 20px 24px' }}>
        <h1 style={{ color: '#f5f0e8', fontSize: 34, fontWeight: 700, letterSpacing: -0.5, margin: 0, fontFamily: ff }}>
          Trends
        </h1>
      </div>

      {/* 1RM Board */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={sectionLabel}>1RM Board</p>
      </div>
      <div style={{ margin: '0 20px 28px', backgroundColor: '#1c1c1e', borderRadius: 14, overflow: 'hidden' }}>
        {PR_BOARD.map((row, i) => {
          const pr = get1RM(row.search)
          const isLast = i === PR_BOARD.length - 1
          return (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', padding: '13px 16px',
              borderBottom: isLast ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ flex: 1, color: 'rgba(245,240,232,0.65)', fontSize: 15, fontFamily: ff }}>
                {row.label}
              </span>
              {pr ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#f5f0e8', fontSize: 17, fontWeight: 700, letterSpacing: -0.3, fontFamily: ff }}>
                    {pr.weight} lbs
                  </span>
                  <span style={{ color: 'rgba(245,240,232,0.28)', fontSize: 12, fontFamily: ff, minWidth: 56, textAlign: 'right' }}>
                    {formatShortDate(pr.date)}
                  </span>
                </div>
              ) : (
                <span style={{ color: 'rgba(245,240,232,0.18)', fontSize: 15, fontFamily: ff }}>—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Weekly Volume */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={sectionLabel}>Weekly Volume</p>
      </div>
      <div style={{ margin: '0 20px 28px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '16px 16px 14px' }}>
        {weekStats ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: '#f5f0e8', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, fontFamily: ff }}>
                  {thisWeekVol > 0 ? `${thisWeekVol.toLocaleString()} lbs` : '—'}
                </span>
                {volDiffLabel() && (
                  <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 13, fontFamily: ff }}>
                    {volDiffLabel()}
                  </span>
                )}
              </div>
              <p style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, margin: '3px 0 0', fontFamily: ff }}>
                This week · strength sets only
              </p>
            </div>
            <BarChart values={weekStats.volume} labels={labels} chartHeight={90} />
          </>
        ) : (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: 14, fontFamily: ff }}>Loading…</span>
          </div>
        )}
      </div>

      {/* Total Reps */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={sectionLabel}>Total Reps</p>
      </div>
      <div style={{ margin: '0 20px 28px', backgroundColor: '#1c1c1e', borderRadius: 14, padding: '16px 16px 14px' }}>
        {weekStats ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ color: '#f5f0e8', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, fontFamily: ff }}>
                  {thisWeekReps > 0 ? thisWeekReps.toLocaleString() : '—'}
                </span>
                {thisWeekReps > 0 && lastWeekReps > 0 && (
                  <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 13, fontFamily: ff }}>
                    {lastWeekReps} last week
                  </span>
                )}
              </div>
              <p style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, margin: '3px 0 0', fontFamily: ff }}>
                This week · strength reps only
              </p>
            </div>
            <BarChart values={weekStats.reps} labels={labels} chartHeight={90} />
          </>
        ) : (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: 14, fontFamily: ff }}>Loading…</span>
          </div>
        )}
      </div>

      {/* Ask Claude */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={sectionLabel}>Ask Claude</p>
      </div>
      <AskClaude sessions={sessions} />
    </div>
  )
}
