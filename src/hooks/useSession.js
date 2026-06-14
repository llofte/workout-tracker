import { useState, useEffect } from 'react'
import { db } from '../db/db'

export function useSessions() {
  const [sessions, setSessions] = useState(null)

  useEffect(() => {
    db.sessions.orderBy('date').reverse().toArray().then(setSessions)
  }, [])

  return sessions
}
