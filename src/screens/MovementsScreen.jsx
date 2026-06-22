import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase, seedSupabaseIfEmpty, syncMovementLibrary } from '../db/supabase'
import MovementDetailScreen from './MovementDetailScreen'
import SwipeBack from '../components/shared/SwipeBack'
import { TAB_CLEARANCE } from '../utils/pwa'
import { normalizeMovement, toLibraryDisplay } from '../utils/movements'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'


function bestPR(prs) {
  if (!prs?.length) return null
  return prs
    .filter(pr => pr.weight != null)
    .reduce((best, pr) => (!best || pr.weight > best.weight ? pr : best), null)
}

function MovementRow({ movement, last, onClick }) {
  const pr = bestPR(movement.prs)
  const { name, implement } = normalizeMovement(movement.name)
  const displayName = toLibraryDisplay(name, implement)
  const repLabel = pr ? (pr.reps === 1 ? '1RM' : `${pr.reps}RM`) : null
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 16px',
      borderBottom: last ? 'none' : '0.5px solid rgba(255,255,255,0.07)',
      cursor: 'pointer',
    }}>
      <p style={{ color: '#f5f0e8', fontSize: 16, fontWeight: 500, margin: 0, fontFamily: ff, flex: 1 }}>
        {displayName}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {pr && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#0ff7c5', fontSize: 16, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1, fontFamily: ff }}>
              {pr.weight}<span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(15,247,197,0.55)', marginLeft: 3 }}>lbs</span>
            </div>
            <div style={{ color: 'rgba(15,247,197,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3, fontFamily: ff }}>
              {repLabel}
            </div>
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,0.22)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  const q = query.trim().toLowerCase()
  const list = (movements ?? [])
    .filter(m => !q || m.name.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

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

      {movements !== null && (
        list.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(245,240,232,0.4)', fontSize: 15, fontFamily: ff }}>No movements found.</p>
          </div>
        ) : (
          <div style={{ margin: '0 20px', backgroundColor: '#201a2a', borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            {list.map((m, i) => (
              <MovementRow key={m.id} movement={m} last={i === list.length - 1} onClick={() => openMovement(m)} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
