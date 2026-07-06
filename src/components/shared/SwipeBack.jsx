import { useRef, useState, useEffect } from 'react'

// Wraps a drill-down screen so a swipe from the left edge slides it away and calls onBack.
export default function SwipeBack({ onBack, children }) {
  const ref = useRef(null)
  const [dx, setDx] = useState(0)
  const [animating, setAnimating] = useState(false)
  // Forces a React re-render on every touchstart/touchend, even ones that don't otherwise
  // touch dx/animating (a tap outside the edge zone, an end() for an inactive gesture).
  // Confirmed by trial: without this "nudge", a touch landing while the snap-back CSS
  // transition is still playing can leave the page frozen mid-transition on iOS — the
  // extra render appears to be what makes the browser actually commit/repaint the
  // transition instead of getting stuck. Traced to this specific mechanism via a visible
  // on-screen debug log (which itself re-rendered on every event) that masked the bug;
  // removing the visible log but keeping an equivalent state bump preserves the fix.
  const [, bump] = useState(0)
  const forceRender = () => bump(n => n + 1)
  const s = useRef({ active: false, startX: 0, startY: 0, locked: null, dx: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function start(e) {
      const t = e.touches[0]
      forceRender()
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
          forceRender()
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
        }
      }
    }
    function end(e) {
      forceRender()
      // Ignore a lifted second finger — only finalize once every touch is up, so the
      // tracked finger can keep driving the drag via touchmove in the meantime.
      if (e.touches && e.touches.length > 0) return
      if (!s.current.active) return
      s.current.active = false
      if (s.current.dx > window.innerWidth * 0.33) {
        setAnimating(true)
        setDx(window.innerWidth)
        setTimeout(() => onBack && onBack(), 220)
      } else if (s.current.dx > 0) {
        setAnimating(true)
        setDx(0)
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
      {children}
    </div>
  )
}
