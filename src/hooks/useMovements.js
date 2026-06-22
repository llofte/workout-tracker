import { useState, useEffect } from 'react'
import { supabase } from '../db/supabase'

let _cache = null

export function useMovements() {
  const [movements, setMovements] = useState(_cache)

  useEffect(() => {
    supabase
      .from('movements')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) {
          _cache = data
          setMovements(data)
        }
      })
  }, [])

  return movements
}

export function invalidateMovementsCache() {
  _cache = null
}
