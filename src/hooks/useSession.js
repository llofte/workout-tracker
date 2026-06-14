import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/db'

export function useSessions() {
  const [sessions, setSessions] = useState(null)

  useEffect(() => {
    const sub = liveQuery(() =>
      db.sessions.orderBy('date').reverse().toArray()
    ).subscribe(setSessions)
    return () => sub.unsubscribe()
  }, [])

  return sessions
}
