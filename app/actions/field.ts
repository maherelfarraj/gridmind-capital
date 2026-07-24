'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthActor, requireWriter } from '@/lib/auth/guard'
import { ensureStorageBucket } from '@/app/actions/storage'
import { maybeCreateDelayInsight } from '@/app/actions/ai-insights'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

const BUCKET = 'documents'
import { getCurrentTenantId } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DailyReportSummary {
  id: string
  report_date: string
  weather: string | null
  workforce_count: number | null
  equipment_count: number | null
  work_summary: string | null
  status: string
  photo_count: number
}

export interface FieldPhoto {
  id: string
  url: string
  storage_path: string
  caption: string | null
  report_id: string | null
  ticket_id: string | null
  created_at: string
  uploaded_by: string | null
}

export interface DailyReportDetail {
  id: string
  project_id: string
  report_date: string
  weather: string | null
  temp_high_c: number | null
  wind_kmh: number | null
  workforce_count: number | null
  equipment_count: number | null
  work_performed: string | null
  delays: string | null
  safety_notes: string | null
  visitors: string | null
  status: string
  submitted_by: string | null
  photos: FieldPhoto[]
}

export interface DailyReportInput {
  report_date: string
  weather?: string | null
  temp_high_c?: number | null
  wind_kmh?: number | null
  workforce_count?: number | null
  equipment_count?: number | null
  work_performed?: string | null
  delays?: string | null
  safety_notes?: string | null
  visitors?: string | null
}

export interface FieldPunchItem {
  id: string
  title: string
  punch_cat: string
  status: string
  location: string | null
  priority: string | null
  created_at: string
}

export interface FieldHome {
  today: DailyReportDetail | null
  activePermits: number
  punchItems: FieldPunchItem[]
  recentPhotos: FieldPhoto[]
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Short-lived signed URL for displaying a stored photo. */
async function signPhoto(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string,
): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? ''
}

// ─────────────────────────────────────────────────────────────
// 1. Recent daily reports (with photo counts)
// ─────────────────────────────────────────────────────────────

export async function getDailyReports(
  projectId: string,
  limit = 30,
): Promise<DailyReportSummary[]> {
  const tenantId = await getCurrentTenantId()
  const auth = await getAuthActor()
  if ('error' in auth) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id, report_date, weather, workforce_count, equipment_count, work_performed, status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  const ids = data.map((r) => r.id as string)
  const counts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: photos } = await supabase
      .from('field_photos')
      .select('report_id')
      .in('report_id', ids)
    for (const p of photos ?? []) {
      const rid = p.report_id as string | null
      if (rid) counts[rid] = (counts[rid] ?? 0) + 1
    }
  }

  // Fire-and-forget: raise a schedule-risk insight if delays recur on 3+
  // consecutive days. Never blocks or fails the read.
  void maybeCreateDelayInsight(projectId).catch(() => {})

  return data.map((r) => ({
    id:              r.id as string,
    report_date:     r.report_date as string,
    weather:         (r.weather as string) ?? null,
    workforce_count: (r.workforce_count as number) ?? null,
    equipment_count: (r.equipment_count as number) ?? null,
    work_summary:    (r.work_performed as string) ?? null,
    status:          (r.status as string) ?? 'draft',
    photo_count:     counts[r.id as string] ?? 0,
  }))
}

// ─────────────────────────────────────────────────────────────
// 2. One daily report for a date (+ its photos)
// ─────────────────────────────────────────────────────────────

export async function getDailyReport(
  projectId: string,
  date: string,
): Promise<DailyReportDetail | null> {
  const tenantId = await getCurrentTenantId()
  const auth = await getAuthActor()
  if ('error' in auth) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('report_date', date)
    .maybeSingle()

  if (error || !data) return null

  const { data: photoRows } = await supabase
    .from('field_photos')
    .select('id, storage_path, caption, report_id, ticket_id, created_at, uploaded_by')
    .eq('tenant_id', tenantId)
    .eq('report_id', data.id)
    .order('created_at', { ascending: false })

  const photos: FieldPhoto[] = await Promise.all(
    (photoRows ?? []).map(async (p) => ({
      id:           p.id as string,
      url:          await signPhoto(supabase, p.storage_path as string),
      storage_path: p.storage_path as string,
      caption:      (p.caption as string) ?? null,
      report_id:    (p.report_id as string) ?? null,
      ticket_id:    (p.ticket_id as string) ?? null,
      created_at:   p.created_at as string,
      uploaded_by:  (p.uploaded_by as string) ?? null,
    })),
  )

  return {
    id:              data.id as string,
    project_id:      data.project_id as string,
    report_date:     data.report_date as string,
    weather:         (data.weather as string) ?? null,
    temp_high_c:     (data.temp_high_c as number) ?? null,
    wind_kmh:        (data.wind_kmh as number) ?? null,
    workforce_count: (data.workforce_count as number) ?? null,
    equipment_count: (data.equipment_count as number) ?? null,
    work_performed:  (data.work_performed as string) ?? null,
    delays:          (data.delays as string) ?? null,
    safety_notes:    (data.safety_notes as string) ?? null,
    visitors:        (data.visitors as string) ?? null,
    status:          (data.status as string) ?? 'draft',
    submitted_by:    (data.submitted_by as string) ?? null,
    photos,
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Upsert a daily report by (project_id, report_date)
// ─────────────────────────────────────────────────────────────

export async function saveDailyReport(
  projectId: string,
  data: DailyReportInput,
): Promise<{ id: string } | { error: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  const fields = {
    weather:         data.weather ?? null,
    temp_high_c:     data.temp_high_c ?? null,
    wind_kmh:        data.wind_kmh ?? null,
    workforce_count: data.workforce_count ?? null,
    equipment_count: data.equipment_count ?? null,
    work_performed:  data.work_performed ?? null,
    delays:          data.delays ?? null,
    safety_notes:    data.safety_notes ?? null,
    visitors:        data.visitors ?? null,
    updated_at:      new Date().toISOString(),
  }

  // Upsert semantics without clobbering an existing report's status.
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('report_date', data.report_date)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('daily_reports')
      .update(fields)
      .eq('id', existing.id)
    if (error) return { error: error.message }
    revalidatePath('/field')
    return { id: existing.id as string }
  }

  const { data: inserted, error } = await supabase
    .from('daily_reports')
    .insert({
      tenant_id:   tenantId,
      project_id:  projectId,
      report_date: data.report_date,
      status:      'draft',
      ...fields,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Could not save report' }
  revalidatePath('/field')
  return { id: inserted.id as string }
}

// ─────────────────────────────────────────────────────────────
// 4. Submit a daily report (draft → submitted)
// ─────────────────────────────────────────────────────────────

export async function submitDailyReport(
  id: string,
  submittedBy: string,
): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  // Prefer the authenticated user id (a real uuid) over a client-supplied value.
  const { error } = await supabase
    .from('daily_reports')
    .update({
      status:       'submitted',
      submitted_by: gate.actor.userId ?? submittedBy,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  revalidatePath('/field')
  return { error: error?.message }
}

// ─────────────────────────────────────────────────────────────
// 4b. Create a punch item (field-raised ticket)
// ─────────────────────────────────────────────────────────────

export interface PunchItemInput {
  title: string
  location?: string | null
  punch_cat: string   // 'A' | 'B' | 'C'
  description?: string | null
}

export async function createFieldPunchItem(
  projectId: string,
  data: PunchItemInput,
): Promise<{ id: string } | { error: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: inserted, error } = await supabase
    .from('tickets')
    .insert({
      tenant_id:   tenantId,
      project_id:  projectId,
      title:       data.title,
      category:    'punch_item',
      status:      'open',
      priority:    'medium',
      description: data.description ?? null,
      assigned_to: gate.actor.userId,
      created_by:  gate.actor.userId,
      metadata:    { punch_cat: data.punch_cat, location: data.location ?? null },
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Could not create punch item' }
  revalidatePath('/field')
  return { id: inserted.id as string }
}

// ─────────────────────────────────────────────────────────────
// 5. Signed upload URL for a field photo
// ─────────────────────────────────────────────────────────────

export async function getPhotoUploadUrl(
  projectId: string,
  fileName: string,
): Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  await ensureStorageBucket()
  const supabase = createAdminClient()

  const storagePath = `field/${projectId}/${randomUUID()}-${fileName}`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Upload URL generation failed' }
  return { uploadUrl: data.signedUrl, storagePath }
}

// ─────────────────────────────────────────────────────────────
// 6. Register a completed field-photo upload
// ─────────────────────────────────────────────────────────────

export async function registerFieldPhoto(
  projectId: string,
  storagePath: string,
  caption: string,
  reportId?: string,
  ticketId?: string,
): Promise<{ id: string } | { error: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('field_photos')
    .insert({
      tenant_id:    tenantId,
      project_id:   projectId,
      storage_path: storagePath,
      caption:      caption || null,
      report_id:    reportId ?? null,
      ticket_id:    ticketId ?? null,
      uploaded_by:  gate.actor.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Could not register photo' }
  revalidatePath('/field')
  return { id: data.id as string }
}

// ─────────────────────────────────────────────────────────────
// 7. Delete a field photo (row + storage object)
// ─────────────────────────────────────────────────────────────

export async function deleteFieldPhoto(id: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('field_photos')
    .select('storage_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path as string])
  }

  const { error } = await supabase
    .from('field_photos')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  revalidatePath('/field')
  return { error: error?.message }
}

// ─────────────────────────────────────────────────────────────
// 8. Mobile home data
// ─────────────────────────────────────────────────────────────

export async function getFieldHome(projectId: string): Promise<FieldHome> {
  const tenantId = await getCurrentTenantId()
  const empty: FieldHome = { today: null, activePermits: 0, punchItems: [], recentPhotos: [] }

  const auth = await getAuthActor()
  if ('error' in auth) return empty

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()

  const [permitRes, punchRes, photoRes] = await Promise.all([
    supabase
      .from('work_permits')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('status', 'issued')
      .gt('valid_to', nowIso),
    supabase
      .from('tickets')
      .select('id, title, status, priority, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('assigned_to', auth.actor.userId)
      .not('metadata->punch_cat', 'is', null)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('field_photos')
      .select('id, storage_path, caption, report_id, ticket_id, created_at, uploaded_by')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const punchItems: FieldPunchItem[] = (punchRes.data ?? []).map((r) => {
    const meta = (r.metadata as Record<string, unknown>) ?? {}
    return {
      id:         r.id as string,
      title:      (r.title as string) ?? 'Punch item',
      punch_cat:  (meta.punch_cat as string) ?? 'B',
      status:     (r.status as string) ?? 'open',
      location:   (meta.location as string) ?? null,
      priority:   (r.priority as string) ?? null,
      created_at: r.created_at as string,
    }
  })

  const recentPhotos: FieldPhoto[] = await Promise.all(
    (photoRes.data ?? []).map(async (p) => ({
      id:           p.id as string,
      url:          await signPhoto(supabase, p.storage_path as string),
      storage_path: p.storage_path as string,
      caption:      (p.caption as string) ?? null,
      report_id:    (p.report_id as string) ?? null,
      ticket_id:    (p.ticket_id as string) ?? null,
      created_at:   p.created_at as string,
      uploaded_by:  (p.uploaded_by as string) ?? null,
    })),
  )

  const todayReport = await getDailyReport(projectId, today)

  return {
    today:         todayReport,
    activePermits: permitRes.count ?? 0,
    punchItems,
    recentPhotos,
  }
}
