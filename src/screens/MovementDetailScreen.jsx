import { useState, useEffect } from 'react'
import { supabase, rowToSession } from '../db/supabase'
import SessionDetailScreen from './SessionDetailScreen'
import SwipeBack from '../components/shared/SwipeBack'
import { normalizeMovement } from '../utils/movements'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.09)',
  border: 'none',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 15,
  color: '#f5f0e8',
  fontFamily: ff,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function canonName(rawName) {
  return normalizeMovement(rawName).name.toLowerCase()
}

function sessionHasMovement(session, name) {
  const n = canonName(name)
  const hit = m => !m.isRest && canonName(m.name) === n
  const hitAny = m => canonName(m.name) === n
  if (session.strengthBlock?.movements?.some(hitAny)) return true
  if (session.metconBlock?.movements?.some(hit)) return true
  if (session.metconBlock?.segments?.some(seg => seg.movements?.some(hit))) return true
  if (session.metconBlock?.buyIn?.some(hit)) return true
  if (session.metconBlock?.buyOut?.some(hit)) return true
  if (session.accessoryBlock?.movements?.some(hitAny)) return true
  return false
}

function getEntriesFromSession(session, name) {
  const n = canonName(name)
  const match = m => !m.isRest && canonName(m.name) === n
  const matchAny = m => canonName(m.name) === n
  const results = []

  const sm = session.strengthBlock?.movements?.find(matchAny)
  if (sm) {
    results.push({
      context: 'Strength',
      type: 'sets',
      sets: (sm.sets ?? []).filter(s => s.notation !== 'warmup'),
    })
  }

  const metcon = session.metconBlock
  if (metcon) {
    if (metcon.segments?.length) {
      for (const seg of metcon.segments) {
        const mm = seg.movements?.find(match)
        if (mm) {
          results.push({ context: `Metcon · ${metcon.format}`, type: 'move', move: mm, rounds: seg.rounds, format: metcon.format })
          break
        }
      }
    } else if (metcon.movements?.length) {
      const mm = metcon.movements.find(match)
      if (mm) results.push({ context: `Metcon · ${metcon.format}`, type: 'move', move: mm, rounds: metcon.rounds, format: metcon.format })
    }
    const biMove = metcon.buyIn?.find(match)
    if (biMove) results.push({ context: 'Buy In', type: 'move', move: biMove })
    const boMove = metcon.buyOut?.find(match)
    if (boMove) results.push({ context: 'Buy Out', type: 'move', move: boMove })
  }

  const am = session.accessoryBlock?.movements?.find(matchAny)
  if (am) {
    results.push({
      context: 'Accessory',
      type: 'sets',
      sets: (am.sets ?? []).filter(s => s.notation !== 'warmup'),
    })
  }

  return results
}

async function renameMovementInSessions(oldName, newName) {
  const rename = moves => moves?.map(m =>
    (!m.isRest && m.name === oldName) ? { ...m, name: newName } : m
  )
  const { data: rows } = await supabase.from('sessions').select('*')
  const sessions = (rows ?? []).map(rowToSession)
  for (const session of sessions) {
    if (!sessionHasMovement(session, oldName)) continue
    const patch = {}
    if (session.strengthBlock?.movements?.some(m => m.name === oldName)) {
      patch.strength_block = {
        ...session.strengthBlock,
        movements: session.strengthBlock.movements.map(m =>
          m.name === oldName ? { ...m, name: newName } : m
        ),
      }
    }
    if (session.metconBlock) {
      const mb = session.metconBlock
      const hit = mb.movements?.some(m => m.name === oldName) ||
        mb.segments?.some(seg => seg.movements?.some(m => m.name === oldName)) ||
        mb.buyIn?.some(m => m.name === oldName) ||
        mb.buyOut?.some(m => m.name === oldName)
      if (hit) {
        patch.metcon_block = {
          ...mb,
          movements: rename(mb.movements),
          segments: mb.segments?.map(seg => ({ ...seg, movements: rename(seg.movements) })),
          buyIn: rename(mb.buyIn),
          buyOut: rename(mb.buyOut),
        }
      }
    }
    if (session.accessoryBlock?.movements?.some(m => m.name === oldName)) {
      patch.accessory_block = {
        ...session.accessoryBlock,
        movements: session.accessoryBlock.movements.map(m =>
          m.name === oldName ? { ...m, name: newName } : m
        ),
      }
    }
    if (Object.keys(patch).length) {
      await supabase.from('sessions').update(patch).eq('id', session.id)
    }
  }
}

function bestPrsByReps(prs) {
  const map = new Map()
  for (const pr of prs ?? []) {
    if (pr.weight == null) continue
    const existing = map.get(pr.reps)
    if (!existing || pr.weight > existing.weight) map.set(pr.reps, pr)
  }
  return [...map.values()].sort((a, b) => a.reps - b.reps)
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSessionDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function SetChips({ sets }) {
  const working = sets.filter(s => s.reps != null || s.weight != null)
  if (!working.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {working.map((s, i) => {
        const repsStr = s.reps != null ? `${s.reps} ${s.reps === 1 ? 'rep' : 'reps'}` : ''
        const weightStr = s.weight ? `${s.weight} lbs` : ''
        const label = weightStr ? `${repsStr} × ${weightStr}` : repsStr
        return (
          <span key={i} style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'rgba(245,240,232,0.65)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 13,
            fontFamily: ff,
          }}>{label || '—'}</span>
        )
      })}
    </div>
  )
}

function formatReps(moveName, reps) {
  if (reps == null) return ''
  const s = String(reps)
  if (/[a-zA-Z]/.test(s)) return s
  if (/\brow\b|rowing|\bbike\b|cycling|ski\s*erg|assault/i.test(moveName ?? '')) return `${s} cal`
  const n = Number(s)
  return isNaN(n) ? s : `${n} ${n === 1 ? 'rep' : 'reps'}`
}

function MoveChip({ move, rounds, format }) {
  const repsStr = move.reps != null ? formatReps(move.name, move.reps) : ''
  const weightStr = move.weight ? `${move.weight} lbs` : ''
  const roundsStr = rounds && format !== 'AMRAP' ? `${rounds} rounds` : ''
  const label = [repsStr, weightStr, roundsStr].filter(Boolean).join(' · ')
  if (!label) return null
  return (
    <span style={{
      backgroundColor: 'rgba(255,255,255,0.06)',
      color: 'rgba(245,240,232,0.65)',
      borderRadius: 6,
      padding: '3px 8px',
      fontSize: 13,
      fontFamily: ff,
      marginTop: 6,
      display: 'inline-block',
    }}>{label}</span>
  )
}

const sectionLabel = {
  color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontFamily: ff,
}
const fieldLabel = {
  color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px', fontFamily: ff,
}

export default function MovementDetailScreen({ movement: init, onBack, onEdit }) {
  const [record, setRecord] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [editingPr, setEditingPr] = useState(null)
  const [editForm, setEditForm] = useState({ reps: '', weight: '', date: '' })
  const [addingPr, setAddingPr] = useState(false)
  const [addForm, setAddForm] = useState({ reps: '', weight: '', date: new Date().toISOString().split('T')[0] })
  const [confirmDeletePr, setConfirmDeletePr] = useState(null)
  const [confirmDeleteMovement, setConfirmDeleteMovement] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: rec }, { data: allRows }] = await Promise.all([
        supabase.from('movements').select('*').eq('id', init.id).single(),
        supabase.from('sessions').select('*').order('date', { ascending: false }),
      ])
      const allSessions = (allRows ?? []).map(rowToSession)
      setRecord(rec)
      setSessions(allSessions.filter(s => sessionHasMovement(s, init.name)))
    }
    load()
  }, [])

  if (selectedSession) {
    return (
      <SwipeBack onBack={() => setSelectedSession(null)}>
        <SessionDetailScreen
          session={selectedSession}
          onBack={() => setSelectedSession(null)}
          onEdit={s => { setSelectedSession(null); onEdit(s) }}
        />
      </SwipeBack>
    )
  }

  if (!record || sessions === null) {
    return (
      <div style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 40 }}>
        <div style={{ padding: '12px 20px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff7c5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, fontFamily: ff, padding: 0, opacity: 0.8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Movements
          </button>
        </div>
      </div>
    )
  }

  const bestPrs = bestPrsByReps(record.prs)
  const lastDone = sessions[0]?.date

  const hasWeightInHistory = sessions.some(s => {
    const n = record.name.toLowerCase()
    const sm = s.strengthBlock?.movements?.find(m => m.name?.toLowerCase() === n)
    if (sm?.sets?.some(set => set.weight != null && set.weight > 0)) return true
    const am = s.accessoryBlock?.movements?.find(m => m.name?.toLowerCase() === n)
    if (am?.sets?.some(set => set.weight != null && set.weight > 0)) return true
    return false
  })
  const showPrBoard = bestPrs.length > 0 || hasWeightInHistory

  function startEdit(pr) {
    setEditingPr(pr)
    setEditForm({ reps: String(pr.reps), weight: String(pr.weight), date: pr.date })
    setAddingPr(false)
    setConfirmDeletePr(null)
  }

  async function savePrEdit() {
    setSaving(true)
    const newPrs = record.prs.map(pr =>
      pr === editingPr
        ? { ...pr, reps: Number(editForm.reps), weight: Number(editForm.weight), date: editForm.date }
        : pr
    )
    await supabase.from('movements').update({ prs: newPrs }).eq('id', record.id)
    setRecord({ ...record, prs: newPrs })
    setEditingPr(null)
    setSaving(false)
  }

  async function confirmDelete() {
    setSaving(true)
    const newPrs = record.prs.filter(pr => pr !== confirmDeletePr)
    await supabase.from('movements').update({ prs: newPrs }).eq('id', record.id)
    setRecord({ ...record, prs: newPrs })
    setEditingPr(null)
    setConfirmDeletePr(null)
    setSaving(false)
  }

  async function saveName() {
    const newName = nameInput.trim()
    if (!newName || newName === record.name) { setEditingName(false); return }
    setSaving(true)
    const oldName = record.name
    await supabase.from('movements').update({ name: newName }).eq('id', record.id)
    await renameMovementInSessions(oldName, newName)
    const [{ data: updatedRecord }, { data: allRows }] = await Promise.all([
      supabase.from('movements').select('*').eq('id', record.id).single(),
      supabase.from('sessions').select('*').order('date', { ascending: false }),
    ])
    const allSessions = (allRows ?? []).map(rowToSession)
    setRecord(updatedRecord)
    setSessions(allSessions.filter(s => sessionHasMovement(s, newName)))
    setEditingName(false)
    setSaving(false)
  }

  async function handleDeleteMovement() {
    if (!confirmDeleteMovement) { setConfirmDeleteMovement(true); return }
    await supabase.from('movements').delete().eq('id', record.id)
    onBack()
  }

  async function saveAddPr() {
    if (!addForm.reps || !addForm.weight) return
    setSaving(true)
    const newPr = {
      date: addForm.date,
      reps: Number(addForm.reps),
      weight: Number(addForm.weight),
      weightUnit: 'lbs',
      sessionId: null,
    }
    const newPrs = [...(record.prs ?? []), newPr]
    await supabase.from('movements').update({ prs: newPrs }).eq('id', record.id)
    setRecord({ ...record, prs: newPrs })
    setAddingPr(false)
    setAddForm({ reps: '', weight: '', date: new Date().toISOString().split('T')[0] })
    setSaving(false)
  }

  return (
    <div style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: '12px 20px 20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff7c5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, fontFamily: ff, padding: 0, opacity: 0.8, marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Movements
        </button>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              autoFocus
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 20, fontWeight: 700, color: '#f5f0e8', fontFamily: ff, outline: 'none', minWidth: 0 }}
            />
            <button onClick={saveName} disabled={saving} style={{ backgroundColor: '#f5f0e8', color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: ff, flexShrink: 0 }}>
              Save
            </button>
            <button onClick={() => setEditingName(false)} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(245,240,232,0.5)', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff, flexShrink: 0 }}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.2, margin: 0, fontFamily: ff }}>
              {record.name}
            </h1>
            <button onClick={() => { setNameInput(record.name); setEditingName(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(245,240,232,0.28)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        )}
        <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: 14, margin: 0, fontFamily: ff }}>
          {lastDone ? `Last done ${formatSessionDate(lastDone)}` : 'Not yet logged in a session'}
        </p>
      </div>

      {/* PR Board */}
      {showPrBoard && (
        <>
          <div style={{ padding: '0 20px 8px' }}>
            <p style={sectionLabel}>Personal Records</p>
          </div>
          <div style={{ margin: '0 20px 24px', backgroundColor: '#201a2a', borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.07)' }}>

            {bestPrs.map((pr, i) => {
              const isLast = i === bestPrs.length - 1
              const borderBottom = (!isLast || addingPr) ? '0.5px solid rgba(255,255,255,0.08)' : 'none'

              if (editingPr === pr) {
                return (
                  <div key={i} style={{ padding: '14px 16px', borderBottom }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8, marginBottom: 10 }}>
                      <div>
                        <p style={fieldLabel}>Reps</p>
                        <input type="number" inputMode="numeric" value={editForm.reps}
                          onChange={e => setEditForm(f => ({ ...f, reps: e.target.value }))}
                          style={inputStyle} />
                      </div>
                      <div>
                        <p style={fieldLabel}>Weight (lbs)</p>
                        <input type="number" inputMode="decimal" value={editForm.weight}
                          onChange={e => setEditForm(f => ({ ...f, weight: e.target.value }))}
                          style={inputStyle} />
                      </div>
                      <div>
                        <p style={fieldLabel}>Date</p>
                        <input type="date" value={editForm.date}
                          onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                          style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={savePrEdit} disabled={saving || !editForm.reps || !editForm.weight}
                        style={{ flex: 1, backgroundColor: '#f5f0e8', color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff }}>
                        Save
                      </button>
                      {confirmDeletePr === pr ? (
                        <button onClick={confirmDelete} disabled={saving}
                          style={{ flex: 1, backgroundColor: 'rgba(255,59,48,0.18)', color: '#ff6b5e', border: '1px solid rgba(255,59,48,0.35)', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff }}>
                          Confirm Delete
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDeletePr(pr)}
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(245,240,232,0.45)', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff }}>
                          Delete
                        </button>
                      )}
                      <button onClick={() => { setEditingPr(null); setConfirmDeletePr(null) }}
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(245,240,232,0.45)', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom, gap: 12 }}>
                  <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13, fontFamily: ff, width: 52, flexShrink: 0 }}>
                    {pr.reps} {pr.reps === 1 ? 'rep' : 'reps'}
                  </span>
                  <span style={{ color: '#f5f0e8', fontSize: 22, fontWeight: 700, letterSpacing: -0.5, fontFamily: ff, flex: 1 }}>
                    {pr.weight} lbs
                  </span>
                  <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12, fontFamily: ff }}>
                    {formatShortDate(pr.date)}
                  </span>
                  <button onClick={() => startEdit(pr)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 4px 8px', color: 'rgba(245,240,232,0.28)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              )
            })}

            {/* Add PR */}
            {addingPr ? (
              <div style={{ padding: '14px 16px', borderTop: bestPrs.length > 0 ? '0.5px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <p style={fieldLabel}>Reps</p>
                    <input type="number" inputMode="numeric" placeholder="1" value={addForm.reps}
                      onChange={e => setAddForm(f => ({ ...f, reps: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <p style={fieldLabel}>Weight (lbs)</p>
                    <input type="number" inputMode="decimal" placeholder="135" value={addForm.weight}
                      onChange={e => setAddForm(f => ({ ...f, weight: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <p style={fieldLabel}>Date</p>
                    <input type="date" value={addForm.date}
                      onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                      style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveAddPr} disabled={saving || !addForm.reps || !addForm.weight}
                    style={{ flex: 1, backgroundColor: '#f5f0e8', color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff, opacity: (!addForm.reps || !addForm.weight) ? 0.5 : 1 }}>
                    Add
                  </button>
                  <button onClick={() => setAddingPr(false)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(245,240,232,0.45)', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: ff }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingPr(true); setEditingPr(null); setConfirmDeletePr(null) }}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: bestPrs.length > 0 ? '0.5px solid rgba(255,255,255,0.08)' : 'none',
                  color: 'rgba(245,240,232,0.4)', fontSize: 14, fontFamily: ff,
                  padding: '13px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                  boxSizing: 'border-box',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add PR
              </button>
            )}
          </div>
        </>
      )}

      {/* History */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={sectionLabel}>History</p>
      </div>
      <div style={{ padding: '0 20px' }}>
        {sessions.length === 0 ? (
          <div style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '28px 20px', textAlign: 'center', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 14, margin: 0, fontFamily: ff }}>
              No logged sessions yet.
            </p>
          </div>
        ) : sessions.map(session => {
          const entries = getEntriesFromSession(session, record.name)
          return (
            <div key={session.id} onClick={() => setSelectedSession(session)} style={{ backgroundColor: '#201a2a', borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <p style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13, margin: '0 0 10px', fontFamily: ff }}>
                {formatSessionDate(session.date)}
              </p>
              {entries.map((entry, ei) => (
                <div key={ei} style={{ marginBottom: ei < entries.length - 1 ? 10 : 0 }}>
                  <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: ff }}>
                    {entry.context}
                  </span>
                  {entry.type === 'sets' && <SetChips sets={entry.sets} />}
                  {entry.type === 'move' && <MoveChip move={entry.move} rounds={entry.rounds} format={entry.format} />}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Delete movement */}
      <div style={{ padding: '24px 20px 8px' }}>
        <button
          onClick={handleDeleteMovement}
          style={{
            width: '100%',
            backgroundColor: confirmDeleteMovement ? 'rgba(255,59,48,0.18)' : 'rgba(255,255,255,0.04)',
            color: confirmDeleteMovement ? '#ff6b5e' : 'rgba(245,240,232,0.35)',
            border: `1px solid ${confirmDeleteMovement ? 'rgba(255,59,48,0.35)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: ff,
          }}
        >
          {confirmDeleteMovement ? 'Tap again to confirm delete' : 'Delete Movement'}
        </button>
      </div>
    </div>
  )
}
