export const isStandalone =
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)

export const SAFE_BOTTOM = 0
// Standalone: pill flush with screen edge (no gap below) — home indicator is a system overlay.
// Safari: small gap so pill clears the browser chrome.
export const PILL_BOTTOM = isStandalone ? 0 : 8
// Standalone buttons have extra paddingBottom so content sits above the home indicator.
export const TAB_HEIGHT = isStandalone ? 65 : 53
export const TAB_CLEARANCE = TAB_HEIGHT + PILL_BOTTOM + 16
