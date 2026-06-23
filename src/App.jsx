import { useState, useEffect } from 'react'
import TabBar from './components/shared/TabBar'
import HomeScreen from './screens/HomeScreen'
import LogScreen from './screens/LogScreen'
import MovementsScreen from './screens/MovementsScreen'
import CalcScreen from './screens/CalcScreen'
import SessionDetailScreen from './screens/SessionDetailScreen'
import SwipeBack from './components/shared/SwipeBack'
import { useSessions } from './hooks/useSession'
import { PILL_BOTTOM, TAB_HEIGHT } from './utils/pwa'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [tabNonce, setTabNonce] = useState(0)
  const [kbOpen, setKbOpen] = useState(false)
  const [logging, setLogging] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [savedSession, setSavedSession] = useState(null)
  const [logMinimized, setLogMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const { sessions, refetch } = useSessions()

  // Re-tapping the active tab (or switching tabs) returns to that tab's root view and scrolls to top.
  const handleTabChange = (id) => {
    if (id === activeTab) setTabNonce(n => n + 1)
    else setActiveTab(id)
    document.querySelector('main')?.scrollTo({ top: 0 })
  }

  // Hide the tab bar while a text field is focused so it doesn't ride up above the keyboard.
  useEffect(() => {
    const isField = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onFocusIn = e => { if (isField(e.target)) setKbOpen(true) }
    const onFocusOut = () => { setTimeout(() => { if (!isField(document.activeElement)) { setKbOpen(false); window.scrollTo(0, 0) } }, 0) }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  const logOpen = logging || !!editingSession

  const closeLog = () => {
    refetch()
    setLogging(false)
    setEditingSession(null)
    setLogMinimized(false)
    setDragOffset(0)
  }

  const handleSave = (session) => {
    refetch()
    setLogging(false)
    setEditingSession(null)
    setLogMinimized(false)
    setDragOffset(0)
    if (session) setSavedSession(session)
  }

  const minimizeLog = () => {
    setDragOffset(0)
    setLogMinimized(true)
  }

  const restoreLog = () => setLogMinimized(false)

  const handleDragProgress = (y) => setDragOffset(y)

  const handleDragEnd = (y) => {
    setDragOffset(0)
    if (y > 80) minimizeLog()
  }

  return (
    <div style={{ position: 'relative', height: '100%', backgroundColor: '#120c18', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {activeTab === 'home' && <HomeScreen key={'home' + tabNonce} sessions={sessions} kbOpen={kbOpen} logInProgress={logOpen} onLogWorkout={() => setLogging(true)} onEdit={s => setEditingSession(s)} />}
        {activeTab === 'movements' && <MovementsScreen key={'movements' + tabNonce} onEdit={s => setEditingSession(s)} />}
        {activeTab === 'calc' && <CalcScreen key={'calc' + tabNonce} />}
      </main>
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} hidden={kbOpen} />

      {logOpen && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: '#120c18', zIndex: 100,
          overflowY: logMinimized || dragOffset > 0 ? 'hidden' : 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          transform: logMinimized
            ? 'translateY(100%)'
            : dragOffset > 0
              ? `translateY(${dragOffset}px)`
              : 'translateY(0)',
          transition: dragOffset > 0 ? 'none' : 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>
          <LogScreen
            initialSession={editingSession}
            onSave={handleSave}
            onClose={closeLog}
            onMinimize={minimizeLog}
            onDragProgress={handleDragProgress}
            onDragEnd={handleDragEnd}
          />
        </div>
      )}

      {logMinimized && (
        <div
          onClick={restoreLog}
          style={{
            position: 'absolute',
            bottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 61px)',
            left: 12, right: 12, zIndex: 150,
            backgroundColor: '#131820',
            borderRadius: 16,
            border: '1.5px solid #e05c4b',
            padding: '13px 16px',
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#e05c4b', flexShrink: 0 }} />
          <p style={{ color: '#f5f0e8', fontSize: 14, fontWeight: 600, margin: 0, fontFamily: ff, flex: 1 }}>
            Workout in Progress
          </p>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <button
            onClick={e => { e.stopPropagation(); closeLog() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.35)', padding: 4, flexShrink: 0, lineHeight: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {savedSession && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: '#120c18', zIndex: 100,
          overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
        }}>
          <SwipeBack onBack={() => setSavedSession(null)}>
            <SessionDetailScreen
              session={savedSession}
              onBack={() => setSavedSession(null)}
              onEdit={s => { setSavedSession(null); setEditingSession(s) }}
            />
          </SwipeBack>
        </div>
      )}
    </div>
  )
}
