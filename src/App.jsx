import { useState } from 'react'
import TabBar from './components/shared/TabBar'
import HomeScreen from './screens/HomeScreen'
import LogScreen from './screens/LogScreen'
import MovementsScreen from './screens/MovementsScreen'
import CalcScreen from './screens/CalcScreen'

const ff = '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [logging, setLogging] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [logMinimized, setLogMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)

  const logOpen = logging || !!editingSession

  const closeLog = () => {
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
    <div style={{ backgroundColor: '#0a0a0a', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
        {activeTab === 'home' && <HomeScreen onLogWorkout={() => setLogging(true)} onEdit={s => setEditingSession(s)} />}
        {activeTab === 'movements' && <MovementsScreen onEdit={s => setEditingSession(s)} />}
        {activeTab === 'calc' && <CalcScreen />}
      </main>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {logOpen && (
        <>
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: '#0a0a0a', zIndex: 100,
            overflowY: logMinimized || dragOffset > 0 ? 'hidden' : 'auto',
            overscrollBehavior: 'none',
            transform: logMinimized
              ? 'translateY(100dvh)'
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
                position: 'fixed',
                bottom: 'calc(env(safe-area-inset-bottom) + 58px)',
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
