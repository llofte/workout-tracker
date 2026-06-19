export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

export const SAFE_BOTTOM = 0
export const PILL_BOTTOM = isStandalone ? 0 : 8
export const TAB_HEIGHT = 53
export const TAB_CLEARANCE = TAB_HEIGHT + PILL_BOTTOM + 16
