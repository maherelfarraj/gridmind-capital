'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'
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

export async function exportAuditCsvAction(): Promise<string> {
  const { rows } = await getAuditEventsAction({ page: 0 })

  const header = ['id', 'transition_code', 'from_state', 'to_state', 'actor_id', 'comment', 'created_at']
  const lines = rows.map(r =>
    [r.id, r.transition_code ?? '', r.from_state ?? '', r.to_state ?? '', r.actor_id ?? '', (r.comment ?? '').replace(/,/g, ';'), r.created_at]
      .map(v => `"${v}"`).join(',')
  )
  return [header.join(','), ...lines].join('\n')
}
