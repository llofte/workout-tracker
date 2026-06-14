import { useState, useEffect } from 'react'
import { supabase } from '../db/supabase'

export function useMovements() {
  const [movements, setMovements] = useState(null)

  useEffect(() => {
    supabase
      .from('movements')
      .select('*')
      .order('name')
      .then(({ data }) => { if (data) setMovements(data) })
  }, [])

  return movements
}
