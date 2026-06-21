import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase, seedSupabaseIfEmpty, syncMovementLibrary } from '../db/supabase'
import MovementDetailScreen from './MovementDetailScreen'
import SwipeBack from '../components/shared/SwipeBack'
import { TAB_CLEARANCE } from '../utils/pwa'
import { normalizeMovement, toLibraryDisplay } from '../utils/movements'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

const GROUPS = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cardio', 'Other']

function inferGroup(movement) {
  const { name, implement } = normalizeMovement(movement.name)
  if (implement === 'Dumbbell') return 'Dumbbell'
  if (implement === 'Kettlebell' || /^KB /i.test(name)) return 'Kettlebell'
  if (/deadlift|snatch|clean|jerk|\bpress\b|(back|front|overhead|sumo|goblet)\s+squat|hang power|thruster|rdl|sdhp/i.test(name)) return 'Barbell'
  if (/^kb /i.test(name) || /kettlebell|swing/i.test(name)) return 'Kettlebell'
  if (/\brun\b|running|\brow\b|rowing|\bbike\b|cycling|ski\s*erg|double under|single under/i.test(name)) return 'Cardio'
  return 'Other'
}

function groupMovements(movements) {
  const map = { Barbell: [], Dumbbell: [], Kettlebell: [], Cardio: [], Other: [] }
  for (const m of movements) map[inferGroup(m)].push(m)
  return map
}

function best1RM(prs) {
  if (!prs?.length) return null
  return prs
    .filter(pr => pr.reps === 1 && pr.weight != null)
    .reduce((best, pr) => (!best || pr.weight > best.weight ? pr : best), null)
}

function MovementRow({ movement, last, onClick, show1RM = false }) {
  const pr = show1RM ? best1RM(movement.prs) : null
  const { name, implement } = normalizeMovement(movement.name)
  const displayName = toLibraryDisplay(name, implement)
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 16px',
      borderBottom: last ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
      cursor: 'pointer',
    }}>
      <p style={{ color: '#f5f0e8', fontSize: 16, fontWeight: 500, margin: 0, fontFamily: ff }}>
        {displayName}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {pr && (
          <div style={{ textAlign: 'right' }}>
            <span style={{
              backgroundColor: 'rgba(192,57,43,0.2)', color: '#e05c4b',
              borderRadius: 6, padding: '2px 7px', fontSize: 12, fontWeight: 600,
              display: 'block', marginBottom: 2, fontFamily: ff,
            }}>
              {pr.weight} lbs · 1RM
            </span>
            <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 11, fontFamily: ff }}>
              {new Date(pr.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}

export default function MovementsScreen({ onEdit }) {
  const [movements, setMovements] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const savedScrollY = useRef(0)

  useEffect(() => {
    syncMovementLibrary().then(() => {
      supabase.from('movements').select('*').order('name')
        .then(async ({ data }) => {
          if (!data || data.length === 0) {
            await seedSupabaseIfEmpty()
            const { data: seeded } = await supabase.from('movements').select('*').order('name')
            setMovements(seeded ?? [])
          } else {
            setMovements(data)
          }
        })
    })
  }, [refreshKey])

  useLayoutEffect(() => {
    if (!selected) {
      const main = document.querySelector('main')
      if (main) main.scrollTop = savedScrollY.current
    }
  }, [selected])

  const openMovement = m => {
    savedScrollY.current = document.querySelector('main')?.scrollTop ?? 0
    setSelected(m)
  }

  if (selected) {
    return (
      <SwipeBack onBack={() => { setSelected(null); setRefreshKey(k => k + 1) }}>
        <MovementDetailScreen
          movement={selected}
          onBack={() => { setSelected(null); setRefreshKey(k => k + 1) }}
          onEdit={onEdit}
        />
      </SwipeBack>
    )
  }

  const isSearching = query.trim().length > 0
  const filtered = isSearching
    ? (movements ?? []).filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    : []
  const groups = !isSearching ? groupMovements(movements ?? []) : null

  return (
    <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: TAB_CLEARANCE }}>
      <div style={{ padding: '20px 20px 12px' }}>
        <h1 style={{ color: '#f5f0e8', fontSize: 20, fontWeight: 700, letterSpacing: -0.2, margin: 0, fontFamily: ff }}>
          Movements
        </h1>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <input
          style={{
            width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 12,
            padding: '10px 14px', fontSize: 16, color: '#f5f0e8', fontFamily: ff,
            outline: 'none', display: 'block', boxSizing: 'border-box',
          }}
          type="search"
          placeholder="Search movements…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {movements === null && null}

      {/* Search results — flat list */}
      {isSearching && movements !== null && (
        filtered.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 15, fontFamily: ff }}>No movements found.</p>
          </div>
        ) : (
          <div style={{ margin: '0 20px', backgroundColor: '#201a2a', borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            {filtered.map((m, i) => (
              <MovementRow key={m.id} movement={m} last={i === filtered.length - 1} onClick={() => openMovement(m)} />
            ))}
          </div>
        )
      )}

      {/* Grouped view */}
      {!isSearching && groups !== null && GROUPS.map(group => {
        const items = groups[group]
        if (!items.length) return null
        return (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{ padding: '0 20px 8px' }}>
              <p style={{
                color: 'rgba(245,240,232,0.4)', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontFamily: ff,
              }}>
                {group}
              </p>
            </div>
            <div style={{ margin: '0 20px', backgroundColor: '#201a2a', borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              {items.map((m, i) => (
                <MovementRow key={m.id} movement={m} last={i === items.length - 1} onClick={() => openMovement(m)} show1RM={group === 'Barbell'} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
