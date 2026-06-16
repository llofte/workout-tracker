export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

// 28px clears the home indicator without leaving a large empty zone (matches Cheer Dashboard).
// Safari adds its own chrome separately so it needs 0.
export const SAFE_BOTTOM = isStandalone ? 28 : 0
export const TAB_HEIGHT = 49 + SAFE_BOTTOM
export const TAB_CLEARANCE = TAB_HEIGHT + 16
