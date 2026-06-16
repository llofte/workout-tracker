export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

// No bottom padding — home indicator overlays on top of the tab bar, same as native iOS apps.
// Safari handles its own bottom chrome separately.
export const SAFE_BOTTOM = 0
export const TAB_HEIGHT = 49
export const TAB_CLEARANCE = TAB_HEIGHT + 16  // bottom padding for scroll content
