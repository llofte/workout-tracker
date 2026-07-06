import { useRef, useState, useEffect } from 'react'

// TEMPORARY DEBUG — remove once the swipe-back freeze bug is confirmed fixed on-device.
// Logs each touch event + the gesture state at that moment to an on-screen readout,
// since the bug can't be reproduced in the desktop preview at all.
function DebugOverlay({ log }) {
  return (
    <div style={{
      position: 'fixed', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.85)', color: '#0ff7c5', fontSize: 9, fontFamily: 'monospace',
      padding: '4px 6px', maxHeight: 140, overflowY: 'auto', pointerEvents: 'none', whiteSpace: 'pre-wrap',
    }}>
      {log.join('\n')}
    </div>
  )
}

// Wraps a drill-down screen so a swipe from the left edge slides it away and calls onBack.
export default function SwipeBack({ onBack, children }) {
  const ref = useRef(null)
  const [dx, setDx] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [debugLog, setDebugLog] = useState([])
  const s = useRef({ active: false, startX: 0, startY: 0, locked: null, dx: 0 })

  function logDebug(msg) {
    setDebugLog(prev => [...prev.slice(-11), msg])
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function start(e) {
      const t = e.touches[0]
      logDebug(`start x=${Math.round(t.clientX)} touches=${e.touches.length} active=${s.current.active}`)
      // A tap anywhere that isn't a potential edge-swipe must not touch gesture state
      // at all — this used to call setAnimating(false) unconditionally, which cancels
      // an in-flight snap-back CSS transition mid-animation (e.g. a quick tap right
      // after releasing a partial swipe) and freezes the page at whatever partial
      // position it was mid-transition, with no JS tracking and no preventDefault to
      // stop iOS claiming the now-frozen, visually-offset page as a system gesture.
      if (t.clientX > 30) return
      // A second finger joining an already-active edge-drag also fires touchstart —
      // ignore it rather than re-deriving state from its (non-edge) position.
      if (s.current.active) return
      s.current.active = true
      s.current.startX = t.clientX
      s.current.startY = t.clientY
      s.current.locked = null
      s.current.dx = 0
      setAnimating(false)
      // Prevent iOS from claiming this touch sequence as a system gesture
      e.preventDefault()
    }
    function move(e) {
      if (!s.current.active) return
      const t = e.touches[0]
      const mx = t.clientX - s.current.startX
      const my = t.clientY - s.current.startY
      if (s.current.locked === null) {
        // Block iOS system gestures until we determine direction
        e.preventDefault()
        if (Math.abs(mx) > 8 || Math.abs(my) > 8) {
          s.current.locked = Math.abs(mx) > Math.abs(my) ? 'h' : 'v'
          logDebug(`lock=${s.current.locked} mx=${Math.round(mx)} my=${Math.round(my)}`)
          if (s.current.locked === 'v') {
            s.current.active = false
            return
          }
        }
        return
      }
      if (s.current.locked === 'h') {
        e.preventDefault()
        const clamped = Math.max(0, mx)
        s.current.dx = clamped
        setDx(clamped)
        if (clamped === 0) {
          // Pulled back to origin — cancel so the page doesn't stay draggable
          s.current.active = false
          logDebug(`back to 0, active=false`)
        }
      }
    }
    function end(e) {
      logDebug(`end touchesLeft=${e.touches ? e.touches.length : '?'} active=${s.current.active} dx=${s.current.dx} locked=${s.current.locked}`)
      // Ignore a lifted second finger — only finalize once every touch is up, so the
      // tracked finger can keep driving the drag via touchmove in the meantime.
      if (e.touches && e.touches.length > 0) return
      if (!s.current.active) {
        logDebug(`end IGNORED — active was already false`)
        return
      }
      s.current.active = false
      if (s.current.dx > window.innerWidth * 0.33) {
        logDebug(`end -> full close animation`)
        setAnimating(true)
        setDx(window.innerWidth)
        setTimeout(() => onBack && onBack(), 220)
      } else if (s.current.dx > 0) {
        logDebug(`end -> snap back animation`)
        setAnimating(true)
        setDx(0)
      } else {
        logDebug(`end -> dx already 0, no-op`)
      }
    }

    // Non-passive touchstart so we can call preventDefault for left-edge touches
    el.addEventListener('touchstart', start, { passive: false })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [onBack])

  return (
    <div
      ref={ref}
      onTransitionEnd={() => setAnimating(false)}
      style={{
        transform: `translateX(${dx}px)`,
        transition: animating ? 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        minHeight: '100%',
        backgroundColor: '#120c18',
        boxShadow: dx > 0 ? '-12px 0 32px rgba(0,0,0,0.4)' : 'none',
        willChange: 'transform',
      }}
    >
      <DebugOverlay log={debugLog} />
      {children}
    </div>
  )
}
