import { useState, useEffect } from 'react'
import { supabase, rowToSession } from '../db/supabase'

export function useSessions() {
  const [sessions, setSessions] = useState(null)

  async function fetchSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .order('date', { ascending: false })
    if (data) setSessions(data.map(rowToSession))
  }

  useEffect(() => {
    fetchSessions()
    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchSessions)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return sessions
}
