export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

export const SAFE_BOTTOM = 0
export const PILL_BOTTOM = 8  // pill sits just above physical screen edge; home indicator overlays naturally
export const TAB_HEIGHT = 53
export const TAB_CLEARANCE = TAB_HEIGHT + PILL_BOTTOM + 16
