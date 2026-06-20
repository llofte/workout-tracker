import { useState, useEffect } from 'react'
import TabBar from './components/shared/TabBar'
import HomeScreen from './screens/HomeScreen'
import LogScreen from './screens/LogScreen'
import MovementsScreen from './screens/MovementsScreen'
import CalcScreen from './screens/CalcScreen'
import { useSessions } from './hooks/useSession'
import { PILL_BOTTOM, TAB_HEIGHT } from './utils/pwa'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [logging, setLogging] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [logMinimized, setLogMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const { sessions, refetch } = useSessions()

  const [dbg, setDbg] = useState(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;'
      document.body.appendChild(probe)
      const measure = v => { probe.style.height = v; return probe.offsetHeight }
      const sat = measure('env(safe-area-inset-top)')
      const sab = measure('env(safe-area-inset-bottom)')
      document.body.removeChild(probe)
      const app = document.querySelector('#root > div')
      const nav = document.querySelector('nav')
      const nb = nav ? Math.round(nav.getBoundingClientRect().bottom) : -1
      setDbg(
        `iH=${window.innerHeight} vvH=${Math.round(window.visualViewport?.height || 0)}\n` +
        `docCH=${document.documentElement.clientHeight} rootH=${document.getElementById('root').offsetHeight}\n` +
        `appH=${app ? Math.round(app.getBoundingClientRect().height) : '?'}\n` +
        `SAT=${sat} SAB=${sab}\n` +
        `navBottom=${nb} GAP=${window.innerHeight - nb}\n` +
        `standalone=${window.navigator.standalone} dpr=${window.devicePixelRatio}`
      )
    }, 300)
    return () => clearTimeout(t)
  }, [])

  const logOpen = logging || !!editingSession

  const closeLog = () => {
    refetch()
    setLogging(false)
    setEditingSession(null)
    setLogMinimized(false)
    setDragOffset(0)
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
    <div style={{ position: 'relative', height: '100%', backgroundColor: '#242422', display: 'flex', flexDirection: 'column' }}>
      {dbg && (
        <div style={{ position: 'fixed', top: 'env(safe-area-inset-top)', left: 6, zIndex: 99999, background: 'rgba(220,0,0,0.95)', color: '#fff', font: '11px ui-monospace, monospace', padding: '6px 8px', borderRadius: 6, whiteSpace: 'pre', lineHeight: 1.35, pointerEvents: 'none' }}>
          {dbg}
        </div>
      )}
      <main style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
        {activeTab === 'home' && <HomeScreen sessions={sessions} onLogWorkout={() => setLogging(true)} onEdit={s => setEditingSession(s)} />}
        {activeTab === 'movements' && <MovementsScreen onEdit={s => setEditingSession(s)} />}
        {activeTab === 'calc' && <CalcScreen />}
      </main>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {logOpen && (
        <>
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: '#242422', zIndex: 100,
            overflowY: logMinimized || dragOffset > 0 ? 'hidden' : 'auto',
            overscrollBehavior: 'none',
            transform: logMinimized
              ? 'translateY(100%)'
              : dragOffset > 0
                ? `translateY(${dragOffset}px)`
                : 'translateY(0)',
            transition: dragOffset > 0 ? 'none' : 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
            <LogScreen
              initialSession={editingSession}
              onSave={closeLog}
              onClose={closeLog}
              onMinimize={minimizeLog}
              onDragProgress={handleDragProgress}
              onDragEnd={handleDragEnd}
            />
          </div>

          {logMinimized && (
            <div
              onClick={restoreLog}
              style={{
                position: 'absolute',
                bottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 61px)',
                left: 12, right: 12, zIndex: 99,
                backgroundColor: 'rgba(28,28,30,0.96)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 16,
                border: '0.5px solid rgba(255,255,255,0.12)',
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
        </>
      )}
    </div>
  )
}
