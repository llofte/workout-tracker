export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

export const SAFE_BOTTOM = 0
export const PILL_BOTTOM = isStandalone ? 28 : 8  // floating pill offset from screen bottom
export const TAB_HEIGHT = 53                        // pill height (8 padding + icon + gap + label + 8 padding)
export const TAB_CLEARANCE = TAB_HEIGHT + PILL_BOTTOM + 16
