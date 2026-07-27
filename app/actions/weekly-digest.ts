'use server'

/**
 * Weekly digest for GridMind Capital.
 *
 * All content compilation lives here (single source of truth, reusing the real
 * DAL + schema). Emails render with the shared branded template family from
 * lib/email/send.ts and route through the prefs-aware sendEmail() primitive,
 * so every digest is logged to email_log.
 *
 * Two entry points:
 *   - sendWeeklyDigests(): batch for all PM/admin/sponsor users (called by the
 *     weekly-digest Edge Function via the /api/cron/weekly-digest route).
 *   - sendTestDigest(): sends only to the current admin (the "Send test digest"
 *     button in Admin Settings).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapHtml, heading, para } from '@/lib/email/send'

import { getCurrentTenantId } from '@/lib/tenant'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridmind-gules.vercel.app'

// Roles that receive a digest (mapped from admin/sponsor/PM to the real enum).
const DIGEST_ROLES = [
  'system_admin', 'tenant_admin', 'project_director', 'project_manager', 'finance_manager',
]
// Roles that see EVERY project (portfolio-wide digest).
const PORTFOLIO_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'finance_manager']

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((a.getTime() - b.getTime()) / 86400000))
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

type Admin = ReturnType<typeof createAdminClient>

interface ProjectDigest {
  code: string
  name: string
  projectId: string
  currentGate: string
  gateStatus: string
  progressPct: number
  approvalsPending: number
  oldestApprovalDays: number
  approvalsDecided: number
  overdueItems: number
  topOverdue: { title: string; due: string }[]
  openNcrs: number
  oldestNcrDays: number
  vosPending: number
  vosPendingValue: number
  budgetConsumedPct: number
  deliverablesPct: number
  marginErosion: boolean
  overdueMilestones: number
  overdueAmount: number
  nextMilestone: { title: string; date: string; amount: number } | null
}

/** Compile the digest for a single user. Returns null if they have no projects. */
async function compileUserDigest(
  admin: Admin,
  user: { id: string; role: string | null; full_name: string | null },
): Promise<ProjectDigest[] | null> {
  const since = new Date(Date.now() - WEEK_MS)
  const now = new Date()
  const tenantId = await getCurrentTenantId()

  // Resolve THEIR projects. Portfolio roles see all active; PMs see projects
  // they manage (project_manager stores the manager name or id).
  let projQuery = admin
    .from('projects')
    .select('id, code, name, current_phase, status, budget_usd, spent_usd, project_manager')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
  if (!PORTFOLIO_ROLES.includes(user.role ?? '')) {
    // PM scope — match on manager name or id.
    projQuery = projQuery.or(
      `project_manager.eq.${user.full_name ?? '∅'},project_manager.eq.${user.id}`,
    )
  }
  const { data: projects } = await projQuery
  if (!projects?.length) return null

  const out: ProjectDigest[] = []
  for (const p of projects) {
    const [gatesRes, apprPendRes, apprDecidedRes, ncrRes, voRes, costRes, msRes] = await Promise.all([
      admin.from('phase_gates').select('status').eq('project_id', p.id),
      admin.from('approvals').select('id, title, due_date, created_at')
        .eq('assignee_id', user.id).eq('status', 'pending'),
      admin.from('approvals').select('id').eq('tenant_id', tenantId)
        .not('decided_at', 'is', null).gte('decided_at', since.toISOString()),
      admin.from('ncrs').select('raised_at, status').eq('project_id', p.id).neq('status', 'closed'),
      admin.from('variation_orders').select('cost_impact, status').eq('project_id', p.id).eq('status', 'submitted'),
      admin.from('cost_entries').select('actual_amount').eq('project_id', p.id),
      admin.from('payment_milestones').select('title, planned_date, planned_amount, invoice_amount, paid_at, invoiced_at, due_date')
        .eq('project_id', p.id),
    ])

    // Gate + progress (approved gate_records / 8).
    const gates = gatesRes.data ?? []
    const approvedGates = gates.filter((g) => g.status === 'approved').length
    const progressPct = Math.round((approvedGates / 8) * 100)
    const phase = num(p.current_phase)

    // Approvals pending on THEM.
    const apprPend = apprPendRes.data ?? []
    const oldestApprovalDays = apprPend.length
      ? Math.max(...apprPend.map((a) => daysBetween(now, new Date(a.created_at as string))))
      : 0
    // Overdue items = pending approvals past their due_date (real due dates).
    const overdueApprovals = apprPend.filter((a) => a.due_date && new Date(a.due_date as string) < now)
    const topOverdue = overdueApprovals
      .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime())
      .slice(0, 3)
      .map((a) => ({ title: (a.title as string) ?? 'Item', due: (a.due_date as string).slice(0, 10) }))

    // Open NCRs.
    const ncrs = ncrRes.data ?? []
    const oldestNcrDays = ncrs.length
      ? Math.max(...ncrs.map((n) => daysBetween(now, new Date(n.raised_at as string))))
      : 0

    // VOs pending client decision.
    const vos = voRes.data ?? []
    const vosPendingValue = vos.reduce((s, v) => s + num(v.cost_impact), 0)

    // Budget consumed % vs deliverables complete %.
    const actualCost = (costRes.data ?? []).reduce((s, c) => s + num(c.actual_amount), 0)
    const spent = actualCost > 0 ? actualCost : num(p.spent_usd)
    const budget = num(p.budget_usd)
    const budgetConsumedPct = budget > 0 ? Math.round((spent / budget) * 100) : 0
    const deliverablesPct = progressPct
    const marginErosion = budgetConsumedPct - deliverablesPct > 10

    // Payment milestones — overdue + next upcoming.
    const ms = msRes.data ?? []
    const overdue = ms.filter((m) => m.invoiced_at && !m.paid_at && m.due_date && new Date(m.due_date as string) < now)
    const overdueAmount = overdue.reduce((s, m) => s + (num(m.invoice_amount) - 0), 0)
    const upcoming = ms
      .filter((m) => !m.paid_at && m.planned_date && new Date(m.planned_date as string) >= now)
      .sort((a, b) => new Date(a.planned_date as string).getTime() - new Date(b.planned_date as string).getTime())[0]

    out.push({
      code: p.code as string,
      name: p.name as string,
      projectId: p.id as string,
      currentGate: `G${phase}`,
      gateStatus: (p.status as string) ?? 'active',
      progressPct,
      approvalsPending: apprPend.length,
      oldestApprovalDays,
      approvalsDecided: (apprDecidedRes.data ?? []).length,
      overdueItems: overdueApprovals.length,
      topOverdue,
      openNcrs: ncrs.length,
      oldestNcrDays,
      vosPending: vos.length,
      vosPendingValue,
      budgetConsumedPct,
      deliverablesPct,
      marginErosion,
      overdueMilestones: overdue.length,
      overdueAmount,
      nextMilestone: upcoming
        ? { title: upcoming.title as string, date: (upcoming.planned_date as string).slice(0, 10), amount: num(upcoming.planned_amount) }
        : null,
    })
  }
  return out
}

/** Render a compact per-project section table. */
function renderProjectSection(d: ProjectDigest): string {
  const row = (k: string, v: string, flag = false) =>
    `<tr>
       <td style="padding:5px 0;font-size:12px;color:#495670;width:210px;">${k}</td>
       <td style="padding:5px 0;font-size:12px;color:${flag ? '#ef4444' : '#e6f1ff'};font-weight:${flag ? 700 : 500};">${v}</td>
     </tr>`
  const topOverdue = d.topOverdue.length
    ? d.topOverdue.map((o) => `${o.title} (due ${o.due})`).join('<br/>')
    : '—'
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;background:#0a192f;border:1px solid #1e3a5f;border-radius:10px;">
    <tr><td style="padding:14px 18px;border-bottom:1px solid #1e3a5f;">
      <span style="font-size:15px;font-weight:700;color:#64ffda;">${d.code}</span>
      <span style="font-size:13px;color:#8892b0;"> — ${d.name}</span>
    </td></tr>
    <tr><td style="padding:12px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tbody>
        ${row('Current gate', `${d.currentGate} · ${d.gateStatus} · ${d.progressPct}% complete`)}
        ${row('Approvals pending on you', d.approvalsPending ? `${d.approvalsPending} (oldest ${d.oldestApprovalDays}d)` : '0', d.approvalsPending > 0)}
        ${row('Approvals decided last week', String(d.approvalsDecided))}
        ${row('Overdue items', d.overdueItems ? String(d.overdueItems) : '0', d.overdueItems > 0)}
        ${d.overdueItems ? row('Top overdue', topOverdue, true) : ''}
        ${row('Open NCRs', d.openNcrs ? `${d.openNcrs} (oldest ${d.oldestNcrDays}d)` : '0', d.openNcrs > 0)}
        ${row('VOs pending client decision', d.vosPending ? `${d.vosPending} · ${fmtUsd(d.vosPendingValue)}` : '0')}
        ${row('Budget consumed vs complete', `${d.budgetConsumedPct}% vs ${d.deliverablesPct}%${d.marginErosion ? ' — MARGIN EROSION' : ''}`, d.marginErosion)}
        ${row('Overdue payment milestones', d.overdueMilestones ? `${d.overdueMilestones} · ${fmtUsd(d.overdueAmount)}` : '0', d.overdueMilestones > 0)}
        ${row('Next milestone', d.nextMilestone ? `${d.nextMilestone.title} — ${d.nextMilestone.date} · ${fmtUsd(d.nextMilestone.amount)}` : '—')}
      </tbody></table>
    </td></tr>
  </table>`
}

/** Build the full digest HTML for a user's projects. */
function renderDigest(recipientName: string, weekOf: string, projects: ProjectDigest[]): string {
  const sections = projects.map(renderProjectSection).join('')
  return wrapHtml(`
    ${heading(`Weekly Digest — Week of ${weekOf}`)}
    ${para(`Hi ${recipientName}, here is your portfolio summary across ${projects.length} project${projects.length !== 1 ? 's' : ''}.`)}
    ${sections}
    <a href="${BASE_URL}/portfolio" style="display:inline-block;margin-top:8px;padding:10px 22px;background:#64ffda;color:#0a192f;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">Open Portfolio Dashboard</a>
  `)
}

function weekOfLabel(): string {
  const d = new Date()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Send a digest to one user; returns the send status. Skips users with no projects. */
async function sendDigestToUser(
  admin: Admin,
  user: { id: string; email: string | null; role: string | null; full_name: string | null },
  opts: { ignorePrefs?: boolean } = {},
): Promise<'sent' | 'skipped' | 'failed' | 'no-projects'> {
  if (!user.email) return 'skipped'
  const projects = await compileUserDigest(admin, user)
  if (!projects || projects.length === 0) return 'no-projects'
  const html = renderDigest(user.full_name ?? 'there', weekOfLabel(), projects)
  const res = await sendEmail({
    to: user.email,
    userId: user.id,
    // Test sends bypass the digest opt-out (the admin explicitly requested it).
    ignorePrefs: opts.ignorePrefs,
    type: 'digest',
    subject: `GridMind Weekly Digest — Week of ${weekOfLabel()}`,
    html,
  })
  return res.status
}

/** Batch send to all eligible users. Called by the cron route. */
export async function sendWeeklyDigests(): Promise<{ sent: number; skipped: number; failed: number }> {
  const admin = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data: users } = await admin
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', DIGEST_ROLES)

  let sent = 0, skipped = 0, failed = 0
  for (const u of users ?? []) {
    const r = await sendDigestToUser(admin, u)
    if (r === 'sent') sent++
    else if (r === 'failed') failed++
    else skipped++
  }
  return { sent, skipped, failed }
}

/** Admin "Send test digest" — sends only to the currently authenticated user. */
export async function sendTestDigest(): Promise<{ ok: boolean; status?: string; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Not authenticated.' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) return { ok: false, message: 'Profile not found.' }

  const status = await sendDigestToUser(admin, profile, { ignorePrefs: true })
  if (status === 'no-projects') {
    return { ok: false, message: 'You have no active projects to summarize.' }
  }
  if (status === 'failed') {
    return { ok: false, status, message: 'Digest compiled but email failed (check RESEND_API_KEY). Logged to email_log.' }
  }
  return { ok: true, status, message: `Test digest ${status === 'sent' ? 'sent to' : 'processed for'} ${profile.email}.` }
}
