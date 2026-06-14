import { createClient } from '@supabase/supabase-js'
import { MOVEMENTS_BASELINE } from './db'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export function rowToSession(row) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    program: row.program,
    strengthBlock: row.strength_block,
    metconBlock: row.metcon_block,
    accessoryBlock: row.accessory_block,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export function sessionToRow(session) {
  return {
    id: session.id,
    date: session.date,
    title: session.title ?? null,
    program: session.program ?? 'BB WOD',
    strength_block: session.strengthBlock ?? null,
    metcon_block: session.metconBlock ?? null,
    accessory_block: session.accessoryBlock ?? null,
    notes: session.notes ?? null,
  }
}

export async function migrateFromDexie() {
  if (localStorage.getItem('dexie_migrated')) return
  try {
    const { db } = await import('./db')
    const localSessions = await db.sessions.toArray()
    const realSessions = localSessions.filter(s => s.notes !== 'test')
    if (!realSessions.length) { localStorage.setItem('dexie_migrated', '1'); return }
    const rows = realSessions.map(s => sessionToRow({ ...s, id: crypto.randomUUID() }))
    const { error } = await supabase.from('sessions').insert(rows)
    if (!error) localStorage.setItem('dexie_migrated', '1')
  } catch (e) {
    console.error('Dexie migration failed:', e)
  }
}

export async function seedSupabaseIfEmpty() {
  const { count } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
  if (count > 0) return
  const rows = MOVEMENTS_BASELINE.map(m => ({
    id: crypto.randomUUID(),
    name: m.name,
    aliases: m.aliases,
    category: m.category,
    prs: m.prs,
  }))
  await supabase.from('movements').insert(rows)
}
