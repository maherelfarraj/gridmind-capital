/**
 * Email notification system for GridMind Capital.
 *
 * All sends route through the central `sendEmail()` primitive, which:
 *   1. Respects the recipient's notification_prefs (per email type).
 *   2. Invokes the Supabase `send-email` Edge Function (which calls Resend).
 *      The Edge Function reads RESEND_API_KEY from its own secrets; when the
 *      key is absent it returns { sent:false, reason:'no API key' } so we can
 *      log a test-mode row instead of throwing.
 *   3. Logs every attempt to `email_log` (status sent|failed).
 *
 * Sends are fire-and-forget and never throw — a failed email must never break
 * the originating action.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { NOT_SET_LABEL } from '@/lib/format-nullable'
import { buildEmail, getUserLocale, heading, para, kvTable, btn } from '@/lib/email/render'

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'notifications@gridmind.capital'
const FROM = `GridMind Capital <${FROM_ADDRESS}>`
export const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? 'admin@gridmind.capital'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridmind-gules.vercel.app'

export type EmailType =
  | 'approval'
  | 'ncr'
  | 'vo'
  | 'escalation'
  | 'mention'
  | 'digest'
  | 'general'

// Maps an email type to the notification_prefs column that gates it.
// Types not present here (general) are always sent.
const TYPE_TO_PREF: Partial<Record<EmailType, string>> = {
  approval: 'email_on_approval',
  ncr: 'email_on_ncr',
  vo: 'email_on_vo',
  escalation: 'email_on_escalation',
  mention: 'email_on_mention',
  digest: 'email_weekly_digest',
}

// ─── Central primitive ────────────────────────────────────────

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  type: EmailType
  /** Recipient profile id — enables prefs check + per-user email_log. */
  userId?: string | null
  /** Skip the notification_prefs opt-out check (e.g. an explicit test send). */
  ignorePrefs?: boolean
  /**
   * BCP-47 locale of the recipient ('en' | 'ar').
   * Stored in email_log for per-locale metrics. The html passed here must
   * already have been built with buildEmail() when locale !== 'en'.
   */
  locale?: string
}): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }> {
  const admin = createAdminClient()

  // 1. Preference gate (only when we know the recipient + the type is gated).
  const prefColumn = TYPE_TO_PREF[opts.type]
  if (opts.userId && prefColumn && !opts.ignorePrefs) {
    try {
      const { data: prefs } = await admin
        .from('notification_prefs')
        .select(prefColumn)
        .eq('user_id', opts.userId)
        .maybeSingle()
      // Explicit opt-out (row exists and column is false) → skip. Default = send.
      if (prefs && (prefs as unknown as Record<string, boolean>)[prefColumn] === false) {
        return { status: 'skipped' }
      }
    } catch {
      // If prefs can't be read, fail open (send) — better to over-notify.
    }
  }

  // 2. Invoke the Edge Function (service-role JWT passes verify_jwt).
  let status: 'sent' | 'failed' = 'sent'
  let error: string | undefined
  try {
    const { data, error: fnErr } = await admin.functions.invoke('send-email', {
      body: { to: opts.to, subject: opts.subject, html: opts.html, from: FROM },
    })
    if (fnErr) {
      status = 'failed'
      error = fnErr.message
    } else if (data && (data as { sent?: boolean }).sent === false) {
      status = 'failed'
      error = (data as { reason?: string }).reason ?? 'not sent'
    }
  } catch (e) {
    status = 'failed'
    error = e instanceof Error ? e.message : 'send failed'
  }

  // 3. Log every attempt.
  try {
    await admin.from('email_log').insert({
      user_id: opts.userId ?? null,
      type: opts.type,
      subject: opts.subject,
      status,
      error: error ?? null,
    })
  } catch (e) {
    console.error('[email] email_log insert failed:', e)
  }

  return { status, error }
}

// ─── Shared HTML wrapper ──────────────────────────────────────
// wrapHtml is kept for backwards compat with existing callers.
// For locale-aware HTML use buildEmail() from lib/email/render.ts directly.

export function wrapHtml(content: string, locale = 'en'): string {
  return buildEmail({ locale, body: content })
}

// Re-export the locale-aware helpers from render.ts so callers
// that import from send.ts don't need to change their imports.
export { heading, para, kvTable, btn } from '@/lib/email/render'

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ─── Typed senders ────────────────────────────────────────────

// ─── Locale labels used in typed senders ─────────────────────

const L: Record<string, Record<string, string>> = {
  en: {
    approvalRequest:   'Approval Request',
    hi:                'Hi',
    yourApproval:      'your approval is required.',
    reviewAndDecide:   'Review & Decide',
    actionRequired:    'Action Required',
    title:             'Title',
    requestedBy:       'Requested by',
    project:           'Project',
    due:               'Due',
    asap:              'As soon as possible',
    approvalApproved:  'Approval Approved',
    approvalRejected:  'Approval Rejected',
    requestApproved:   'your request has been',
    approved:          'approved',
    rejected:          'rejected',
    decision:          'Decision',
    decidedBy:         'Decided by',
    reason:            'Reason',
    viewDetails:       'View Details',
  },
  ar: {
    approvalRequest:   'طلب اعتماد',
    hi:                'مرحباً',
    yourApproval:      'يلزم اعتمادك على هذا الطلب.',
    reviewAndDecide:   'مراجعة واتخاذ قرار',
    actionRequired:    'إجراء مطلوب',
    title:             'العنوان',
    requestedBy:       'مقدَّم من',
    project:           'المشروع',
    due:               'الموعد النهائي',
    asap:              'في أقرب وقت ممكن',
    approvalApproved:  'تمت الموافقة',
    approvalRejected:  'تم الرفض',
    requestApproved:   'تمت معالجة طلبك:',
    approved:          'موافق عليه',
    rejected:          'مرفوض',
    decision:          'القرار',
    decidedBy:         'القرار من قِبَل',
    reason:            'السبب',
    viewDetails:       'عرض التفاصيل',
  },
}

function l(locale: string, key: string): string {
  return (L[locale] ?? L['en'])[key] ?? (L['en'][key] ?? key)
}

export async function sendApprovalRequestEmail(opts: {
  to: string
  userId?: string | null
  approverName: string
  title: string
  requestedBy: string
  projectCode: string
  projectName: string
  dueDate?: string
  approvalId: string
}) {
  const locale = opts.userId ? await getUserLocale(opts.userId) : 'en'
  const approvalUrl = `${BASE_URL}/approvals?id=${opts.approvalId}`
  const body = [
    heading(l(locale, 'approvalRequest'), locale),
    para(`${l(locale, 'hi')} ${opts.approverName}، ${l(locale, 'yourApproval')}`, locale),
    kvTable([
      [l(locale, 'title'),       opts.title],
      [l(locale, 'requestedBy'), opts.requestedBy],
      [l(locale, 'project'),     `${opts.projectCode} — ${opts.projectName}`],
      [l(locale, 'due'),         opts.dueDate ?? l(locale, 'asap')],
    ], locale),
    btn(l(locale, 'reviewAndDecide'), approvalUrl),
  ].join('\n')
  const html = buildEmail({ locale, subject: `${l(locale, 'actionRequired')}: ${opts.title}`, body })
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'approval',
    locale,
    subject: `${l(locale, 'actionRequired')}: ${opts.title} — ${opts.projectCode}`,
    html,
  })
}

export async function sendApprovalDecisionEmail(opts: {
  to: string
  userId?: string | null
  requesterName: string
  title: string
  decision: 'approved' | 'rejected'
  decisionBy: string
  projectCode: string
  reason?: string
  approvalId: string
}) {
  const locale = opts.userId ? await getUserLocale(opts.userId) : 'en'
  const projectUrl = `${BASE_URL}/approvals?id=${opts.approvalId}`
  const isApproved = opts.decision === 'approved'
  const decisionLabel = isApproved ? l(locale, 'approved') : l(locale, 'rejected')
  const subjectBase  = isApproved ? l(locale, 'approvalApproved') : l(locale, 'approvalRejected')
  const statusColor  = isApproved ? '#64ffda' : '#ef4444'
  const body = [
    heading(subjectBase, locale),
    para(`${l(locale, 'hi')} ${opts.requesterName}، ${l(locale, 'requestApproved')} <strong style="color:${statusColor}">${decisionLabel}</strong>.`, locale),
    kvTable([
      [l(locale, 'title'),     opts.title],
      [l(locale, 'decision'),  decisionLabel.toUpperCase()],
      [l(locale, 'decidedBy'), opts.decisionBy],
      [l(locale, 'project'),   opts.projectCode],
      ...(opts.reason ? [[l(locale, 'reason'), opts.reason] as [string, string]] : []),
    ], locale),
    btn(l(locale, 'viewDetails'), projectUrl),
  ].join('\n')
  const html = buildEmail({ locale, subject: `${subjectBase}: ${opts.title}`, body })
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'approval',
    locale,
    subject: `${subjectBase}: ${opts.title} — ${opts.projectCode}`,
    html,
  })
}

export async function sendNcrEmail(opts: {
  to: string
  userId?: string | null
  ncrNumber: string
  title: string
  status: string
  projectCode: string
  projectId: string
  ncrId: string
}) {
  const url = `${BASE_URL}/projects/${opts.projectId}/ncrs`
  const html = wrapHtml(`
    ${heading(`NCR ${opts.ncrNumber} — ${opts.status}`)}
    ${para(`A non-conformance report has been updated and requires your attention.`)}
    ${kvTable([
      ['NCR', opts.ncrNumber],
      ['Title', opts.title],
      ['Status', opts.status],
      ['Project', opts.projectCode],
    ])}
    ${btn('Open NCR Register', url)}
  `)
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'ncr',
    subject: `NCR ${opts.ncrNumber} (${opts.status}) — ${opts.projectCode}`,
    html,
  })
}

export async function sendVoEmail(opts: {
  to: string
  userId?: string | null
  voNumber: string
  title: string
  status: string
  costImpact: number
  projectCode: string
  projectId: string
}) {
  const url = `${BASE_URL}/projects/${opts.projectId}/variation-orders`
  const html = wrapHtml(`
    ${heading(`Variation Order ${opts.voNumber} — ${opts.status}`)}
    ${para(`A variation order has been updated.`)}
    ${kvTable([
      ['VO', opts.voNumber],
      ['Title', opts.title],
      ['Status', opts.status],
      ['Cost impact', fmtUsd(opts.costImpact)],
      ['Project', opts.projectCode],
    ])}
    ${btn('Open VO Register', url)}
  `)
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'vo',
    subject: `VO ${opts.voNumber} (${opts.status}) — ${opts.projectCode}`,
    html,
  })
}

export async function sendEscalationEmail(opts: {
  to: string
  userId?: string | null
  milestoneTitle: string
  amount: number
  daysOverdue: number
  level: number
  projectCode: string
  projectId: string
}) {
  const url = `${BASE_URL}/projects/${opts.projectId}/cash-flow`
  const html = wrapHtml(`
    ${heading(`Payment Escalation — Level ${opts.level}`)}
    ${para(`An overdue payment milestone has been escalated and needs action.`)}
    ${kvTable([
      ['Milestone', opts.milestoneTitle],
      ['Amount', fmtUsd(opts.amount)],
      ['Days overdue', String(opts.daysOverdue)],
      ['Escalation level', `L${opts.level}`],
      ['Project', opts.projectCode],
    ])}
    ${btn('Open Cash Flow', url)}
  `)
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'escalation',
    subject: `Escalation L${opts.level}: ${opts.milestoneTitle} — ${opts.projectCode}`,
    html,
  })
}

export async function sendMentionEmail(opts: {
  to: string
  userId?: string | null
  mentionedBy: string
  snippet: string
  link: string
}) {
  const url = `${BASE_URL}${opts.link.startsWith('/') ? opts.link : `/${opts.link}`}`
  const html = wrapHtml(`
    ${heading('You were mentioned')}
    ${para(`<strong style="color:#e6f1ff">${opts.mentionedBy}</strong> mentioned you in a comment:`)}
    ${kvTable([['Comment', opts.snippet]])}
    ${btn('View Comment', url)}
  `)
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'mention',
    subject: `${opts.mentionedBy} mentioned you`,
    html,
  })
}

// ─── Legacy senders (project / gate / document) ───────────────
// These predate the prefs system; they always send (type 'general').

export async function sendProjectCreatedEmail(opts: {
  to: string
  recipientName: string
  projectCode: string
  projectName: string
  technology: string
  /** NULL when no budget has been set yet — renders "Not set", never "$0". */
  budgetUsd: number | null
  projectId: string
}) {
  const projectUrl = `${BASE_URL}/projects/${opts.projectId}`
  const html = wrapHtml(`
    ${heading('New Project Created')}
    ${para(`Hi ${opts.recipientName}, a new project has been created on GridMind Capital.`)}
    ${kvTable([
      ['Code', opts.projectCode],
      ['Name', opts.projectName],
      ['Technology', opts.technology],
      ['Budget', opts.budgetUsd == null ? NOT_SET_LABEL : fmtUsd(opts.budgetUsd)],
    ])}
    ${btn('Open Project', projectUrl)}
  `)
  return sendEmail({
    to: opts.to,
    type: 'general',
    subject: `New Project: ${opts.projectCode} — ${opts.projectName}`,
    html,
  })
}

export async function sendGateConveneEmail(opts: {
  to: string[]
  chairName: string
  projectCode: string
  projectName: string
  gateName: string
  gateCode: string
  meetingDate?: string
  projectId: string
}) {
  const gateUrl = `${BASE_URL}/stage-gates?project=${opts.projectId}`
  const html = wrapHtml(`
    ${heading(`Gate Review Convened: ${opts.gateCode}`)}
    ${para(`A gate review has been convened by <strong style="color:#e6f1ff">${opts.chairName}</strong>.`)}
    ${kvTable([
      ['Gate', `${opts.gateCode} — ${opts.gateName}`],
      ['Project', `${opts.projectCode} — ${opts.projectName}`],
      ...(opts.meetingDate ? [['Scheduled', opts.meetingDate] as [string, string]] : []),
    ])}
    ${para('Please review the gate package and prepare your sign-off.')}
    ${btn('Open Gate Review', gateUrl)}
  `)
  return sendEmail({
    to: opts.to,
    type: 'general',
    subject: `Gate Review Convened: ${opts.gateCode} — ${opts.projectCode}`,
    html,
  })
}

export async function sendDocumentUploadEmail(opts: {
  to: string[]
  uploaderName: string
  fileName: string
  documentCode: string
  projectCode: string
  projectId?: string
}) {
  const docUrl = `${BASE_URL}/documents`
  const html = wrapHtml(`
    ${heading('New Document Uploaded')}
    ${para(`<strong style="color:#e6f1ff">${opts.uploaderName}</strong> has uploaded a new document.`)}
    ${kvTable([
      ['Document', opts.documentCode],
      ['File', opts.fileName],
      ['Project', opts.projectCode],
    ])}
    ${btn('View Documents', docUrl)}
  `)
  return sendEmail({
    to: opts.to,
    type: 'general',
    subject: `New Document: ${opts.documentCode} — ${opts.projectCode}`,
    html,
  })
}
