import { useState, useEffect, useCallback } from 'react'
import { supabase, rowToSession } from '../db/supabase'

export function useSessions() {
  const [sessions, setSessions] = useState(null)

  const fetchSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('date', { ascending: false })
    if (data) {
      setSessions(data.map(rowToSession))
    } else if (error) {
      // Network wasn't ready (common on PWA cold launch) — retry once after 2s
      setTimeout(async () => {
        const { data: d2 } = await supabase
          .from('sessions')
          .select('*')
          .order('date', { ascending: false })
        if (d2) setSessions(d2.map(rowToSession))
      }, 2000)
    }
  }, [])

  useEffect(() => {
    fetchSessions()

    // Refetch whenever the app is foregrounded (PWA home screen tap after backgrounding)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchSessions() }
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchSessions)
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [fetchSessions])

  return { sessions, refetch: fetchSessions }
}
