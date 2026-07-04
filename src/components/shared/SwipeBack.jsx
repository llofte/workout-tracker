import { useRef, useState, useEffect } from 'react'

// Wraps a drill-down screen so a swipe from the left edge slides it away and calls onBack.
export default function SwipeBack({ onBack, children }) {
  const ref = useRef(null)
  const [dx, setDx] = useState(0)
  const [animating, setAnimating] = useState(false)
  const s = useRef({ active: false, startX: 0, startY: 0, locked: null, dx: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function start(e) {
      const t = e.touches[0]
      s.current.active = t.clientX <= 30
      s.current.startX = t.clientX
      s.current.startY = t.clientY
      s.current.locked = null
      s.current.dx = 0
      setAnimating(false)
      // Prevent iOS from claiming this touch sequence as a system gesture
      if (s.current.active) e.preventDefault()
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
    function end() {
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
