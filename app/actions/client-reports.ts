'use server'

/**
 * Client reports for GridMind Capital.
 *
 * A client report is a versioned, client-SAFE progress summary for a single
 * project. "Client-safe" means it deliberately EXCLUDES all internal financials
 * — budget, actual spend, margin, cost consumption, internal contingency. It
 * includes only what the client is entitled to see: schedule/gate progress,
 * contractual milestone dates + amounts, VO status counts, and open-quality
 * headline counts.
 *
 * Reports are immutable snapshots: the compiled data is frozen into
 * client_reports.snapshot at generation time and versioned per project. A report
 * is 'draft' (watermarked) until an authorised user issues it, which freezes the
 * PDF into the private `reports` storage bucket.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logExport } from '@/app/actions/exports'

import { getCurrentTenantId } from '@/lib/tenant'
import { numOrNull } from '@/lib/format-nullable'
import { requireUser } from '@/lib/guards'
const BUCKET = 'reports'
const WRITE_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'commercial_manager']

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

type Admin = ReturnType<typeof createAdminClient>

interface Actor { userId: string | null; role: string | null; fullName: string | null }
async function getActor(): Promise<Actor> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles').select('role, full_name').eq('id', user.id).single()
    return { userId: user.id, role: profile?.role ?? null, fullName: profile?.full_name ?? null }
  } catch {
    return { userId: null, role: null, fullName: null }
  }
}
// null role = dev/unauthed, treated as writer for the demo.
const canWrite = (role: string | null) => role == null || WRITE_ROLES.includes(role)

// ─── Client-safe snapshot ─────────────────────────────────────

export interface ClientReportSnapshot {
  // Nullable where the DB is nullable, so the view labels absence ("Not set")
  // instead of the mapper inventing "0 MW" / "—" for a lender.
  project: { code: string; name: string; technology: string | null; capacityMw: number | null; location: string | null; country: string | null; targetCompletion: string | null }
  progress: { currentGate: string; percentComplete: number; health: string; status: string }
  gates: { code: string; name: string; status: string; reviewedAt: string | null }[]
  milestones: { title: string; plannedDate: string | null; amount: number; status: string }[]
  variations: { total: number; approved: number; pending: number; approvedValue: number }
  quality: { openNcrs: number }
  narrative: string
}

/** Compile the client-safe snapshot for a project (NO internal financials). */
async function compileSnapshot(admin: Admin, projectId: string): Promise<ClientReportSnapshot | null> {
  const { data: p } = await admin
    .from('projects')
    .select('code, name, technology, capacity_mw, location, country, target_completion, current_phase, health, status')
    .eq('id', projectId).maybeSingle()
  if (!p) return null

  const [gatesRes, msRes, voRes, ncrRes] = await Promise.all([
    admin.from('phase_gates').select('phase_number, phase_name, status, reviewed_at')
      .eq('project_id', projectId).order('phase_number'),
    // Milestones: expose contractual dates + amounts (client-facing), never internal cost.
    admin.from('payment_milestones').select('title, planned_date, planned_amount, status')
      .eq('project_id', projectId).order('planned_date'),
    admin.from('variation_orders').select('status, cost_impact').eq('project_id', projectId),
    admin.from('ncrs').select('status').eq('project_id', projectId).neq('status', 'closed'),
  ])

  const gates = gatesRes.data ?? []
  const approvedGates = gates.filter((g) => g.status === 'approved').length
  const percentComplete = Math.round((approvedGates / 8) * 100)
  const phase = num(p.current_phase)

  const vos = voRes.data ?? []
  const approvedVos = vos.filter((v) => v.status === 'approved')

  return {
    project: {
      code: p.code as string,
      name: p.name as string,
      technology: (p.technology as string | null) ?? null,
      // Keep NULL as NULL: `num()` mapped it to 0, which printed a fabricated
      // "0 MW" in a lender document and made the view's null-check dead code.
      capacityMw: numOrNull(p.capacity_mw),
      // '—' here is truthy, so it leaked into the "site, country" join as
      // "—, Jordan". Leave absence to the view to label.
      location: (p.location as string | null) ?? null,
      country: (p.country as string | null) ?? null,
      targetCompletion: (p.target_completion as string) ?? null,
    },
    progress: {
      currentGate: `G${phase}`,
      percentComplete,
      health: (p.health as string) ?? 'green',
      status: (p.status as string) ?? 'active',
    },
    gates: gates.map((g) => ({
      code: `G${num(g.phase_number)}`,
      name: (g.phase_name as string) ?? '',
      status: (g.status as string) ?? 'pending',
      reviewedAt: (g.reviewed_at as string) ?? null,
    })),
    milestones: (msRes.data ?? []).map((m) => ({
      title: m.title as string,
      plannedDate: (m.planned_date as string) ?? null,
      amount: num(m.planned_amount),
      status: (m.status as string) ?? 'planned',
    })),
    variations: {
      total: vos.length,
      approved: approvedVos.length,
      pending: vos.filter((v) => v.status === 'submitted').length,
      approvedValue: approvedVos.reduce((s, v) => s + num(v.cost_impact), 0),
    },
    quality: { openNcrs: (ncrRes.data ?? []).length },
    narrative:
      `As of the reporting date, ${p.code} has completed gate ${approvedGates} of 8 (${percentComplete}%). ` +
      `The project is currently at ${`G${phase}`} with an overall health status of ${(p.health as string) ?? 'green'}.`,
  }
}

// ─── Types returned to the UI ─────────────────────────────────

export interface ClientReport {
  id: string
  projectId: string
  version: number
  periodLabel: string
  title: string
  status: 'draft' | 'issued'
  snapshot: ClientReportSnapshot
  storagePath: string | null
  issuedAt: string | null
  createdAt: string
}

function mapRow(r: Record<string, unknown>): ClientReport {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    version: num(r.version),
    periodLabel: r.period_label as string,
    title: r.title as string,
    status: (r.status as 'draft' | 'issued') ?? 'draft',
    snapshot: (r.snapshot as ClientReportSnapshot) ?? ({} as ClientReportSnapshot),
    storagePath: (r.storage_path as string) ?? null,
    issuedAt: (r.issued_at as string) ?? null,
    createdAt: r.created_at as string,
  }
}

// ─── Queries ──────────────────────────────────────────────────

/** All report versions for a project, newest first. */
export async function listClientReports(projectId: string): Promise<ClientReport[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('client_reports')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
  return (data ?? []).map(mapRow)
}

/** Preview the current client-safe snapshot WITHOUT persisting a version. */
export async function previewClientReport(projectId: string): Promise<{ snapshot: ClientReportSnapshot } | { error: string }> {
  const admin = createAdminClient()
  const snapshot = await compileSnapshot(admin, projectId)
  if (!snapshot) return { error: 'Project not found' }
  return { snapshot }
}

// ─── Mutations ────────────────────────────────────────────────

/** Generate a new DRAFT report version by freezing the current snapshot. */
export async function generateClientReport(opts: {
  projectId: string
  periodLabel?: string
}): Promise<{ report: ClientReport } | { error: string }> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to generate client reports.' }

  const admin = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const snapshot = await compileSnapshot(admin, opts.projectId)
  if (!snapshot) return { error: 'Project not found' }

  const { data: last } = await admin
    .from('client_reports').select('version')
    .eq('project_id', opts.projectId).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = num(last?.version) + 1

  const periodLabel = opts.periodLabel ??
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const title = `${snapshot.project.code} — Client Progress Report (${periodLabel})`

  const { data, error } = await admin
    .from('client_reports')
    .insert({
      tenant_id: tenantId,
      project_id: opts.projectId,
      version,
      period_label: periodLabel,
      title,
      status: 'draft',
      snapshot,
      generated_by: actor.userId,
    })
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to generate report' }
  revalidatePath(`/projects/${opts.projectId}/client-report`)
  return { report: mapRow(data) }
}

/** Issue (approve-for-release) a draft report and attach its frozen PDF. */
export async function issueClientReport(opts: {
  reportId: string
  projectId: string
  pdfBase64: string // data URL or raw base64 of the rendered PDF
}): Promise<{ report: ClientReport } | { error: string }> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to issue client reports.' }

  const admin = createAdminClient()
  const tenantId = await getCurrentTenantId()
  await ensureReportsBucket(admin)

  // Decode the PDF and upload to the private reports bucket.
  const base64 = opts.pdfBase64.includes(',') ? opts.pdfBase64.split(',')[1] : opts.pdfBase64
  const bytes = Buffer.from(base64, 'base64')
  const { data: rpt } = await admin.from('client_reports').select('version').eq('id', opts.reportId).maybeSingle()
  const storagePath = `${tenantId}/${opts.projectId}/client-report-v${num(rpt?.version)}-${Date.now()}.pdf`

  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'application/pdf', upsert: true,
  })
  if (upErr) return { error: `PDF upload failed: ${upErr.message}` }

  const { data, error } = await admin
    .from('client_reports')
    .update({
      status: 'issued',
      storage_path: storagePath,
      issued_by: actor.userId,
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.reportId)
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to issue report' }

  // Audit the issue on the shared export/event spine.
  await logExport({ projectId: opts.projectId, register: 'client-report', filters: { version: num(rpt?.version) }, rowCount: 1 })
    .catch(() => {})

  revalidatePath(`/projects/${opts.projectId}/client-report`)
  return { report: mapRow(data) }
}

/** Short-lived signed URL to download an issued report's frozen PDF. */
export async function getClientReportUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  try {
    await requireUser()
  } catch (e: any) {
    return { error: 'Unauthorized' }
  }

  // Verify report belongs to caller's tenant
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()
  
  const { data: report, error: reportErr } = await admin
    .from('client_reports')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('storage_path', `%${storagePath}%`)
    .single()
  
  if (reportErr || !report) return { error: 'Report not found or access denied' }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 300)
  if (error || !data) return { error: error?.message ?? 'Could not create download link' }
  return { url: data.signedUrl }
}

async function ensureReportsBucket(admin: Admin) {
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 20971520, // 20 MB
    })
  }
}
