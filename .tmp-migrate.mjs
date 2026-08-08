import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`[v0] Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}`)

  // 1. Fetch the orphaned gate_number=5 row (dead G5FormData shape) to archive.
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

  // 2. Re-key legacy rows to canonical numbers. Order: highest legacy number first
  //    to avoid transient (project_id, gate_number) collisions.
  //    legacy 4 -> 6 (Construction), legacy 2 -> 4 (Engineering/IFC).
  //    legacy 3->5, 6->7, 7->8 are no-ops today (no rows) but run for completeness.
  const renumbers = [
    { from: 4, to: 6, label: 'Construction' },
    { from: 2, to: 4, label: 'Engineering/IFC' },
    { from: 3, to: 5, label: 'Commercial->Procurement (no-op expected)' },
    { from: 6, to: 7, label: 'Construction->Commissioning slot (no-op expected, ran after 4->6 so this refers to pre-existing 6 only)' },
    { from: 7, to: 8, label: 'Commissioning->Handover slot (no-op expected)' },
  ]

  for (const { from, to, label } of renumbers) {
    const { data: rows, error: fetchErr } = await supabase
      .from('gate_submissions')
      .select('id, project_id, tenant_id, gate_number, form_data, status, submitted_at')
      .eq('gate_number', from)

    if (fetchErr) { console.error(`[v0] fetch error for gate_number=${from}:`, fetchErr); process.exit(1) }
    if (!rows || rows.length === 0) { console.log(`[v0] ${from} -> ${to} (${label}): no rows, skipping.`); continue }

    console.log(`[v0] ${from} -> ${to} (${label}): ${rows.length} row(s) found: ${rows.map(r => r.id).join(', ')}`)

    if (DRY_RUN) continue

    for (const row of rows) {
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
  }

  console.log('[v0] Done.')
}

main()
