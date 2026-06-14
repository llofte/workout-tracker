import { useState, useEffect } from 'react'
import { db } from '../db/db'

export function useMovements() {
  const [movements, setMovements] = useState(null)

  useEffect(() => {
    db.movements.orderBy('name').toArray().then(setMovements)
  }, [])

  return movements
}
