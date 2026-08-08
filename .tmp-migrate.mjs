import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`[v0] Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}`)

  // 1. Archive + delete the orphaned gate_number=5 row (dead G5FormData/
  //    mechanical-completion shape) BEFORE any renumbering, so it can never
  //    collide with a row being moved into gate_number=5 by this same run.
  const { data: orphan, error: orphanErr } = await supabase
    .from('gate_submissions')
    .select('id, project_id, tenant_id, gate_number, form_data, status, submitted_at')
    .eq('gate_number', 5)
    .maybeSingle()

  if (orphanErr) { console.error('[v0] orphan fetch error:', orphanErr); process.exit(1) }
  if (!orphan) { console.log('[v0] No row at gate_number=5 — skipping archive+delete step.') }
  else {
    console.log('[v0] Found orphaned gate_number=5 row to archive:', orphan.id)
    if (!DRY_RUN) {
      const { error: auditErr } = await supabase.from('audit_log').insert({
        tenant_id: orphan.tenant_id,
        table_name: 'gate_submissions',
        record_id: orphan.id,
        action: 'delete',
        changed_by: null,
        old_values: orphan.form_data,
        new_values: { op: 'archive_orphaned_gate5_pre_migration', project_id: orphan.project_id, gate_number: orphan.gate_number, status: orphan.status, submitted_at: orphan.submitted_at },
      })
      if (auditErr) { console.error('[v0] audit_log insert FAILED — aborting before delete:', auditErr); process.exit(1) }
      console.log('[v0] Archived orphan row to audit_log.')

      const { error: delErr } = await supabase.from('gate_submissions').delete().eq('id', orphan.id)
      if (delErr) { console.error('[v0] delete FAILED:', delErr); process.exit(1) }
      console.log('[v0] Deleted orphaned gate_number=5 row.')
    }
  }

  // 2. SNAPSHOT every legacy row BEFORE any renumbering write, and compute
  //    the full from->to plan against that snapshot. Updates below are then
  //    applied by row id only — the loop never re-queries by gate_number —
  //    so a row moved into e.g. gate_number=6 by this same run can NEVER be
  //    re-caught by a later "6 -> 7" step. This fixes a real ordering bug
  //    from the first draft (4->6 ran before 6->7 re-queried live state).
  const MAPPING = { 2: 4, 3: 5, 4: 6, 6: 7, 7: 8 }
  const LABELS = {
    2: 'Engineering/IFC',
    3: 'Commercial->Procurement',
    4: 'Construction',
    6: 'Construction slot->Commissioning',
    7: 'Commissioning slot->Handover',
  }

  const { data: allLegacyRows, error: snapshotErr } = await supabase
    .from('gate_submissions')
    .select('id, project_id, tenant_id, gate_number, form_data, status, submitted_at')
    .in('gate_number', Object.keys(MAPPING).map(Number))

  if (snapshotErr) { console.error('[v0] snapshot fetch error:', snapshotErr); process.exit(1) }

  const plan = (allLegacyRows ?? []).map(row => ({ row, from: row.gate_number, to: MAPPING[row.gate_number] }))

  if (plan.length === 0) {
    console.log('[v0] No legacy rows found to renumber.')
  }

  for (const from of Object.keys(MAPPING).map(Number)) {
    const matches = plan.filter(p => p.from === from)
    if (matches.length === 0) {
      console.log(`[v0] ${from} -> ${MAPPING[from]} (${LABELS[from]}): no rows, skipping.`)
    } else {
      console.log(`[v0] ${from} -> ${MAPPING[from]} (${LABELS[from]}): ${matches.length} row(s) found: ${matches.map(m => m.row.id).join(', ')}`)
    }
  }

  if (DRY_RUN) {
    console.log('[v0] Done (dry run — no writes performed).')
    return
  }

  for (const { row, from, to } of plan) {
    const { error: updErr } = await supabase
      .from('gate_submissions')
      .update({ gate_number: to })
      .eq('id', row.id)
    if (updErr) { console.error(`[v0] UPDATE FAILED for row ${row.id} (${from}->${to}):`, updErr); process.exit(1) }

    const { error: auditErr } = await supabase.from('audit_log').insert({
      tenant_id: row.tenant_id,
      table_name: 'gate_submissions',
      record_id: row.id,
      action: 'update',
      changed_by: null,
      old_values: { gate_number: from },
      new_values: { op: 'renumber_legacy_gate_submission', gate_number: to },
    })
    if (auditErr) console.error(`[v0] audit_log insert warning for row ${row.id} (non-fatal):`, auditErr)

    console.log(`[v0] Updated row ${row.id}: gate_number ${from} -> ${to}`)
  }

  console.log('[v0] Done.')
}

main()
