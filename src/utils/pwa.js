export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

export const SAFE_BOTTOM = 0
export const PILL_BOTTOM = 8
export const TAB_HEIGHT = 53
export const TAB_CLEARANCE = 'calc(env(safe-area-inset-bottom) + 85px)'
