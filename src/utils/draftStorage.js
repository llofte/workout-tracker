// Keeps an in-progress (unsaved) Log/Edit session alive in localStorage so it survives
// a killed tab, a backgrounded PWA getting purged by iOS, or just closing the app and
// coming back a day later — previously an in-progress session only lived in React state
// and vanished the moment the page unloaded, with no way to recover it.
const DRAFT_KEY = 'bb-wod-draft-v1'

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDraft(session) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(session))
  } catch {}
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {}
}
