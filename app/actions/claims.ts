'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/guards'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ClaimType = 'time' | 'cost' | 'disruption' | 'other'
export type ClaimStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'settled' | 'withdrawn'

export interface Claim {
  id: string
  tenant_id: string
  project_id: string
  claim_number: string
  title: string
  type: ClaimType
  description: string | null
  amount: number
  eot_days: number
  status: ClaimStatus
  submitted_date: string | null
  response_due: string | null
  resolved_date: string | null
  created_at: string
  updated_at: string
}

export interface ClaimKpis {
  totalCount: number
  openCount: number
  claimedAmount: number
  claimedEotDays: number
  overdueCount: number
}

export interface ClaimsRegister {
  rows: Claim[]
  kpis: ClaimKpis
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null }

async function getActor(): Promise<Actor> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: tenantId, role: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()
    return {
      userId: user.id,
      tenantId: profile?.tenant_id ?? tenantId,
      role: profile?.role ?? null,
    }
  } catch {
    return { userId: null, tenantId: tenantId, role: null }
  }
}

const OPEN_STATUSES: ClaimStatus[] = ['submitted', 'under_review']

/** Append an entry to the shared workflow_events audit spine. */
async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  claim: { id: string; project_id: string; claim_number: string }
  from: ClaimStatus | null
  to: string
  transition: string
  actorId: string | null
  comment?: string
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: {
      module: 'claim',
      claim_id: args.claim.id,
      claim_number: args.claim.claim_number,
      project_id: args.claim.project_id,
    },
  })
}

function mapRow(r: Record<string, unknown>): Claim {
  return {
    id: r.id as string,
    tenant_id: r.tenant_id as string,
    project_id: r.project_id as string,
    claim_number: r.claim_number as string,
    title: r.title as string,
    type: (r.type as ClaimType) ?? 'cost',
    // (constraint: time | cost | disruption | other)
    description: (r.description as string | null) ?? null,
    amount: r.amount == null ? 0 : Number(r.amount),
    eot_days: r.eot_days == null ? 0 : Number(r.eot_days),
    status: (r.status as ClaimStatus) ?? 'submitted',
    submitted_date: (r.submitted_date as string | null) ?? null,
    response_due: (r.response_due as string | null) ?? null,
    resolved_date: (r.resolved_date as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/variations`)
}

/** Next CLM-#### number for the tenant (no DB trigger exists on claims). */
async function nextClaimNumber(admin: ReturnType<typeof createAdminClient>, tenantId: string): Promise<string> {
  const { data } = await admin
    .from('claims')
    .select('claim_number')
    .eq('tenant_id', tenantId)
    .order('claim_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const last = data?.claim_number as string | undefined
  const n = last ? Number(last.replace(/\D/g, '')) || 0 : 0
  return `CLM-${String(n + 1).padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function getClaims(projectId: string): Promise<ClaimsRegister> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('claims')
    .select('*')
    .eq('project_id', projectId)
    .order('claim_number', { ascending: true })

  const rows = (error || !data ? [] : data).map(mapRow)
  const today = new Date().toISOString().slice(0, 10)

  const openCount      = rows.filter(r => OPEN_STATUSES.includes(r.status)).length
  const claimedAmount  = rows.reduce((s, r) => s + r.amount, 0)
  const claimedEotDays = rows.reduce((s, r) => s + r.eot_days, 0)
  const overdueCount   = rows.filter(r =>
    OPEN_STATUSES.includes(r.status) && r.response_due != null && r.response_due < today,
  ).length

  return {
    rows,
    kpis: { totalCount: rows.length, openCount, claimedAmount, claimedEotDays, overdueCount },
  }
}

// ─────────────────────────────────────────────────────────────
// Create / Update
// ─────────────────────────────────────────────────────────────

export async function createClaim(input: {
  project_id: string
  title: string
  type: ClaimType
  description?: string | null
  amount?: number | null
  eot_days?: number | null
  response_due?: string | null
}): Promise<ActionResult<Claim>> {
  const session = await requireUser()
  
  if (!input.title?.trim()) return { error: 'Title is required' }
  const actor = await getActor()
  const admin = createAdminClient()

  const claim_number = await nextClaimNumber(admin, actor.tenantId)

  const { data, error } = await admin
    .from('claims')
    .insert({
      tenant_id: actor.tenantId,
      project_id: input.project_id,
      claim_number,
      title: input.title.trim(),
      type: input.type,
      description: input.description?.trim() || null,
      amount: input.amount ?? 0,
      eot_days: input.eot_days ?? 0,
      status: 'submitted',
      response_due: input.response_due || null,
    })
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create claim' }
  const claim = mapRow(data)
  await logEvent(admin, { claim, from: null, to: 'submitted', transition: 'CLAIM_CREATE', actorId: actor.userId })
  revalidate(input.project_id)
  return { data: claim }
}

const VALID_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  submitted:    ['under_review', 'accepted', 'rejected', 'withdrawn'],
  under_review: ['accepted', 'rejected', 'settled', 'withdrawn'],
  accepted:     ['settled'],
  rejected:     ['withdrawn'],
  settled:      [],
  withdrawn:    [],
}

/** Terminal states that stamp resolved_date. */
const TERMINAL_STATUSES: ClaimStatus[] = ['accepted', 'rejected', 'settled', 'withdrawn']

export async function updateClaimStatus(
  id: string,
  status: ClaimStatus,
  comment?: string,
): Promise<ActionResult<Claim>> {
  const session = await requireUser()
  
  const actor = await getActor()
  const admin = createAdminClient()

  const { data: existing } = await admin.from('claims').select('*').eq('id', id).single()
  if (!existing) return { error: 'Claim not found' }
  const current = mapRow(existing)
  if (current.status === status) return { data: current }
  if (!VALID_TRANSITIONS[current.status]?.includes(status)) {
    return { error: `Cannot move a "${current.status}" claim to "${status}"` }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status, updated_at: now }
  if (TERMINAL_STATUSES.includes(status)) {
    patch.resolved_date = now.slice(0, 10)
  }

  const { data, error } = await admin
    .from('claims')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Status update failed' }

  const claim = mapRow(data)
  await logEvent(admin, {
    claim, from: current.status, to: status,
    transition: `CLAIM_${status.toUpperCase()}`, actorId: actor.userId, comment,
  })
  revalidate(claim.project_id)
  return { data: claim }
}

// ─────────────────────────────────────────────────────────────
// Demo seed
// ─────────────────────────────────────────────────────────────

export async function seedClaimsDemo(projectId: string): Promise<ActionResult> {
  const session = await requireUser()
  
  const actor = await getActor()
  const admin = createAdminClient()

  const { count } = await admin
    .from('claims')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if ((count ?? 0) > 0) return { error: 'This project already has claims' }

  const today = Date.now()
  const isoDate = (daysFromNow: number) => new Date(today + daysFromNow * 86400000).toISOString().slice(0, 10)

  const seeds: Array<{
    title: string; type: ClaimType; description: string; amount: number; eot_days: number
    status: ClaimStatus; submitted_date: string; response_due: string | null; resolved_date: string | null
  }> = [
    { title: 'Prolongation costs — delayed grid connection', type: 'time', description: 'Extended preliminaries due to utility delay in energising the substation.', amount: 640000, eot_days: 45, status: 'under_review', submitted_date: isoDate(-18), response_due: isoDate(-2), resolved_date: null },
    { title: 'Acceleration of module delivery', type: 'cost', description: 'Additional freight to recover programme after port congestion.', amount: 210000, eot_days: 0, status: 'submitted', submitted_date: isoDate(-6), response_due: isoDate(9), resolved_date: null },
    { title: 'Extension of time — abnormal weather', type: 'time', description: 'Loss of working days from exceptional rainfall in Q2.', amount: 0, eot_days: 14, status: 'accepted', submitted_date: isoDate(-40), response_due: isoDate(-25), resolved_date: isoDate(-20) },
    { title: 'Disruption to cabling works', type: 'disruption', description: 'Out-of-sequence working caused by late civil handover.', amount: 88000, eot_days: 0, status: 'rejected', submitted_date: isoDate(-30), response_due: isoDate(-16), resolved_date: isoDate(-15) },
  ]

  const { error } = await admin.from('claims').insert(
    await Promise.all(seeds.map(async (s, i) => ({
      tenant_id: actor.tenantId,
      project_id: projectId,
      claim_number: `CLM-${String(i + 1).padStart(4, '0')}`,
      title: s.title,
      type: s.type,
      description: s.description,
      amount: s.amount,
      eot_days: s.eot_days,
      status: s.status,
      submitted_date: s.submitted_date,
      response_due: s.response_due,
      resolved_date: s.resolved_date,
    }))),
  )
  if (error) return { error: error.message }
  revalidate(projectId)
  return {}
}
