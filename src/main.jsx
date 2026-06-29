import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { seedSupabaseIfEmpty, migrateFromDexie, patchSessionData } from './db/supabase.js'

migrateFromDexie()
seedSupabaseIfEmpty()
patchSessionData()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' })
      .then(reg => {
        reg.update()
        const existingController = navigator.serviceWorker.controller
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (existingController) window.location.reload()
        })
      })
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
