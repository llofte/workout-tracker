export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

// In standalone PWA mode, the home indicator zone is 34px and we own the full screen.
// In Safari, the browser chrome handles its own bottom safe area — no padding needed.
export const SAFE_BOTTOM = isStandalone ? 34 : 0
export const TAB_HEIGHT = 49 + SAFE_BOTTOM   // 83 standalone, 49 Safari
export const TAB_CLEARANCE = TAB_HEIGHT + 16  // bottom padding for scroll content
