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

const FROM = 'GridMind Capital <notifications@gridmind.capital>'
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
// Types not present here (digest, general) are always sent.
const TYPE_TO_PREF: Partial<Record<EmailType, string>> = {
  approval: 'email_on_approval',
  ncr: 'email_on_ncr',
  vo: 'email_on_vo',
  escalation: 'email_on_escalation',
  mention: 'email_on_mention',
}

// ─── Central primitive ────────────────────────────────────────

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  type: EmailType
  /** Recipient profile id — enables prefs check + per-user email_log. */
  userId?: string | null
}): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }> {
  const admin = createAdminClient()

  // 1. Preference gate (only when we know the recipient + the type is gated).
  const prefColumn = TYPE_TO_PREF[opts.type]
  if (opts.userId && prefColumn) {
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

export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GridMind Capital</title>
</head>
<body style="margin:0;padding:0;background:#0a192f;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#112240;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f;">
          <!-- Header -->
          <tr>
            <td style="background:#0a192f;padding:20px 32px;border-bottom:1px solid #1e3a5f;">
              <span style="font-size:18px;font-weight:700;color:#64ffda;letter-spacing:-0.5px;">GridMind Capital</span>
              <span style="font-size:12px;color:#8892b0;margin-left:8px;">EPC Project Platform</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1e3a5f;background:#0a192f;">
              <p style="margin:0;font-size:11px;color:#495670;">
                This is an automated notification from GridMind Capital.
                <a href="${BASE_URL}" style="color:#64ffda;text-decoration:none;">Open Platform</a>
                &nbsp;·&nbsp;
                <a href="${BASE_URL}/settings" style="color:#495670;text-decoration:none;">Manage email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 22px;background:#64ffda;color:#0a192f;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">${text}</a>`
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#e6f1ff;">${text}</h1>`
}

export function para(text: string): string {
  return `<p style="margin:8px 0;font-size:14px;color:#8892b0;line-height:1.6;">${text}</p>`
}

export function kvTable(rows: [string, string][]): string {
  const cells = rows.map(([k, v]) =>
    `<tr>
       <td style="padding:6px 0;font-size:12px;color:#495670;width:140px;vertical-align:top;">${k}</td>
       <td style="padding:6px 0;font-size:12px;color:#e6f1ff;font-weight:500;">${v}</td>
     </tr>`
  ).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;background:#0a192f;padding:12px 16px;width:100%"><tbody>${cells}</tbody></table>`
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ─── Typed senders ────────────────────────────────────────────

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
  const approvalUrl = `${BASE_URL}/approvals?id=${opts.approvalId}`
  const html = wrapHtml(`
    ${heading('Approval Request')}
    ${para(`Hi ${opts.approverName}, your approval is required.`)}
    ${kvTable([
      ['Title', opts.title],
      ['Requested by', opts.requestedBy],
      ['Project', `${opts.projectCode} — ${opts.projectName}`],
      ['Due', opts.dueDate ?? 'As soon as possible'],
    ])}
    ${btn('Review & Decide', approvalUrl)}
  `)
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'approval',
    subject: `Action Required: ${opts.title} — ${opts.projectCode}`,
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
  const projectUrl = `${BASE_URL}/approvals?id=${opts.approvalId}`
  const isApproved = opts.decision === 'approved'
  const html = wrapHtml(`
    ${heading(`Approval ${isApproved ? 'Approved' : 'Rejected'}`)}
    ${para(`Hi ${opts.requesterName}, your request has been <strong style="color:${isApproved ? '#64ffda' : '#ef4444'}">${opts.decision}</strong>.`)}
    ${kvTable([
      ['Title', opts.title],
      ['Decision', opts.decision.toUpperCase()],
      ['Decided by', opts.decisionBy],
      ['Project', opts.projectCode],
      ...(opts.reason ? [['Reason', opts.reason] as [string, string]] : []),
    ])}
    ${btn('View Details', projectUrl)}
  `)
  return sendEmail({
    to: opts.to,
    userId: opts.userId,
    type: 'approval',
    subject: `Approval ${isApproved ? 'Approved' : 'Rejected'}: ${opts.title}`,
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
  budgetUsd: number
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
      ['Budget', fmtUsd(opts.budgetUsd)],
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
