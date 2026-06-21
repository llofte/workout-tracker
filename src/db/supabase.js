import { createClient } from '@supabase/supabase-js'
import { MOVEMENTS_BASELINE } from './db'
import { normalizeMovement } from '../utils/movements'

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

// One-time migration: dedup movements by canonical name and fill in any missing
// baseline entries. Safe to re-run (idempotent after flag is set).
export async function syncMovementLibrary() {
  if (localStorage.getItem('movements_sync_v2')) return
  try {
    const { data: all } = await supabase.from('movements').select('*')
    if (!all) return

    // Group every row by its canonical name
    const byCanonical = new Map()
    for (const m of all) {
      const { name: canon } = normalizeMovement(m.name)
      if (!byCanonical.has(canon)) byCanonical.set(canon, [])
      byCanonical.get(canon).push(m)
    }

    // Merge duplicates and rename non-canonical rows
    for (const [canon, rows] of byCanonical) {
      const baseline = MOVEMENTS_BASELINE.find(b => b.name === canon)

      // Merge PRs across all rows, deduplicated by date+reps+weight
      const seen = new Set()
      const mergedPrs = rows.flatMap(r => r.prs ?? []).filter(pr => {
        const key = `${pr.date}-${pr.reps}-${pr.weight}`
        return seen.has(key) ? false : (seen.add(key), true)
      })

      // Keep the row whose name already matches canon (or first if none does)
      const survivor = rows.find(r => r.name === canon) ?? rows[0]
      const dupes = rows.filter(r => r.id !== survivor.id)

      if (dupes.length) {
        await supabase.from('movements').delete().in('id', dupes.map(r => r.id))
      }

      const needsUpdate =
        survivor.name !== canon ||
        mergedPrs.length !== (survivor.prs ?? []).length ||
        baseline

      if (needsUpdate) {
        await supabase.from('movements').update({
          name: canon,
          prs: mergedPrs,
          ...(baseline ? { aliases: baseline.aliases, category: baseline.category } : {}),
        }).eq('id', survivor.id)
      }
    }

    // Insert baseline movements that don't exist yet
    const existingCanon = new Set(byCanonical.keys())
    const missing = MOVEMENTS_BASELINE.filter(m => !existingCanon.has(m.name))
    if (missing.length) {
      await supabase.from('movements').insert(
        missing.map(m => ({
          id: crypto.randomUUID(),
          name: m.name,
          aliases: m.aliases,
          category: m.category,
          prs: m.prs,
        }))
      )
    }

    localStorage.setItem('movements_sync_v2', '1')
  } catch (e) {
    console.error('syncMovementLibrary failed:', e)
  }
}
