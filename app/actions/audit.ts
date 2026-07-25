'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin }      from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
const PAGE_SIZE = 50

export interface AuditRow {
  id: string
  instance_id: string | null
  from_state: string | null
  to_state: string | null
  transition_code: string | null
  actor_id: string | null
  actor_name: string | null
  comment: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AuditPage {
  rows: AuditRow[]
  total: number
}

export async function getAuditEventsAction(opts?: {
  page?: number
  search?: string
  transition?: string
}): Promise<AuditPage> {
  const supabase = createAdminClient()
  const page   = opts?.page ?? 0
  const from   = page * PAGE_SIZE
  const to     = from + PAGE_SIZE - 1

  // Build query — join profiles for actor name
  let query = supabase
    .from('workflow_events')
    .select(`
      id,
      instance_id,
      from_state,
      to_state,
      transition_code,
      actor_id,
      comment,
      metadata,
      created_at,
      profiles!workflow_events_actor_id_fkey (full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts?.transition) {
    query = query.eq('transition_code', opts.transition)
  }
  if (opts?.search) {
    query = query.ilike('transition_code', `%${opts.search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    // Fallback: query without the profile join (in case FK alias is different)
    const { data: plain, count: plainCount } = await supabase
      .from('workflow_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    return { rows: (plain ?? []).map(r => ({ ...r, actor_name: null })), total: plainCount ?? 0 }
  }

  const rows: AuditRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    instance_id: r.instance_id,
    from_state: r.from_state,
    to_state: r.to_state,
    transition_code: r.transition_code,
    actor_id: r.actor_id,
    actor_name: r.profiles?.full_name ?? null,
    comment: r.comment,
    metadata: r.metadata,
    created_at: r.created_at,
  }))

  return { rows, total: count ?? 0 }
}

// ─────────────────────────────────────────────────────────────
// audit_log — trigger-written row-level change history (READ ONLY)
// ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  id:          number
  tenant_id:   string | null
  table_name:  string
  record_id:   string | null
  action:      string
  /** Raw actor uuid as written by the trigger; null for system changes */
  changed_by:  string | null
  /** Display name resolved from profiles.full_name; null when unknown */
  changed_by_name: string | null
  old_values:  Record<string, unknown> | null
  new_values:  Record<string, unknown> | null
  /** ISO timestamp */
  changed_at:  string
}

export interface GetAuditLogOptions {
  /** Filter to a specific table (table_name column) */
  tableName?: string
  /** Filter to a specific record id (record_id column) */
  recordId?: string
  /** Maximum rows to return — default 50, hard-capped at 200 */
  limit?: number
}

/** Resolve actor display names in a single batch and merge into rows. */
async function enrichAuditRows(
  rows: Record<string, unknown>[],
): Promise<AuditEntry[]> {
  if (rows.length === 0) return []

  const admin = createAdminClient()
  const actorIds = [
    ...new Set(
      rows
        .map(r => r.changed_by as string | null)
        .filter((id): id is string => !!id),
    ),
  ]

  const nameMap = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds)
    for (const p of profiles ?? []) {
      if (p.full_name) nameMap.set(p.id as string, p.full_name as string)
    }
  }

  return rows.map(r => {
    const changedBy = (r.changed_by as string | null) ?? null
    return {
      id:              r.id          as number,
      tenant_id:       (r.tenant_id  as string | null) ?? null,
      table_name:      r.table_name  as string,
      record_id:       (r.record_id  as string | null) ?? null,
      action:          r.action      as string,
      changed_by:      changedBy,
      changed_by_name: changedBy ? (nameMap.get(changedBy) ?? null) : null,
      old_values:      (r.old_values as Record<string, unknown> | null) ?? null,
      new_values:      (r.new_values as Record<string, unknown> | null) ?? null,
      changed_at:      (r.changed_at as string) ?? '',
    }
  })
}

/**
 * Paginated audit_logs feed, newest-first.
 * Optionally narrowed by tableName (entity_type) and/or recordId (entity_id).
 * Restricted to system_admin and tenant_admin — returns { error } for all
 * other roles, matching the codebase auth-guard contract.
 */
export async function getAuditLog(
  opts: GetAuditLogOptions = {},
): Promise<{ entries: AuditEntry[] } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()

  const { tableName, recordId, limit = 50 } = opts
  const safeLimit = Math.min(Math.max(1, limit), 200)

  const admin = createAdminClient()

  let query = admin
    .from('audit_log')
    .select('id, tenant_id, table_name, record_id, action, changed_by, old_values, new_values, changed_at')
    .eq('tenant_id', tenantId)
    .order('changed_at', { ascending: false })
    .limit(safeLimit)

  if (tableName) query = query.eq('table_name', tableName)
  if (recordId)  query = query.eq('record_id',  recordId)

  const { data, error } = await query
  if (error) return { error: error.message }

  const entries = await enrichAuditRows((data ?? []) as Record<string, unknown>[])
  return { entries }
}

/**
 * Full chronological change timeline for a single record.
 * Returns entries oldest-first so detail panels can render a diff chain.
 * Restricted to system_admin and tenant_admin.
 */
export async function getRecordHistory(
  tableName: string,
  recordId:  string,
): Promise<{ entries: AuditEntry[] } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()

  if (!tableName?.trim()) return { error: 'tableName is required' }
  if (!recordId?.trim())  return { error: 'recordId is required' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('audit_log')
    .select('id, tenant_id, table_name, record_id, action, changed_by, old_values, new_values, changed_at')
    .eq('tenant_id', tenantId)
    .eq('table_name', tableName)
    .eq('record_id',  recordId)
    .order('changed_at', { ascending: true })   // oldest-first for timeline

  if (error) return { error: error.message }

  const entries = await enrichAuditRows((data ?? []) as Record<string, unknown>[])
  return { entries }
}

export async function exportAuditCsvAction(): Promise<string> {
  const { rows } = await getAuditEventsAction({ page: 0 })

  const header = ['id', 'transition_code', 'from_state', 'to_state', 'actor_id', 'comment', 'created_at']
  const lines = rows.map(r =>
    [r.id, r.transition_code ?? '', r.from_state ?? '', r.to_state ?? '', r.actor_id ?? '', (r.comment ?? '').replace(/,/g, ';'), r.created_at]
      .map(v => `"${v}"`).join(',')
  )
  return [header.join(','), ...lines].join('\n')
}
