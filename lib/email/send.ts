/**
 * Email notification system — powered by Resend.
 * All sends are fire-and-forget server-side only.
 * RESEND_API_KEY must be set in Vercel env vars.
 */
import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

const FROM = 'GridMind Capital <notifications@gridmind.capital>'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridmind-gules.vercel.app'

// ─── Shared HTML wrapper ──────────────────────────────────────

function wrapHtml(content: string): string {
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

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 22px;background:#64ffda;color:#0a192f;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">${text}</a>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#e6f1ff;">${text}</h1>`
}

function para(text: string): string {
  return `<p style="margin:8px 0;font-size:14px;color:#8892b0;line-height:1.6;">${text}</p>`
}

function kvTable(rows: [string, string][]): string {
  const cells = rows.map(([k, v]) =>
    `<tr>
       <td style="padding:6px 0;font-size:12px;color:#495670;width:140px;vertical-align:top;">${k}</td>
       <td style="padding:6px 0;font-size:12px;color:#e6f1ff;font-weight:500;">${v}</td>
     </tr>`
  ).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;background:#0a192f;padding:12px 16px;width:100%"><tbody>${cells}</tbody></table>`
}

// ─── Email senders ────────────────────────────────────────────

export async function sendApprovalRequestEmail(opts: {
  to: string
  approverName: string
  title: string
  requestedBy: string
  projectCode: string
  projectName: string
  dueDate?: string
  approvalId: string
}) {
  try {
    const resend = getResend()
    const approvalUrl = `${BASE_URL}/approvals?id=${opts.approvalId}`
    const html = wrapHtml(`
      ${heading('Approval Request')}
      ${para(`Hi ${opts.approverName}, your approval is required.`)}
      ${kvTable([
        ['Title',       opts.title],
        ['Requested by',opts.requestedBy],
        ['Project',     `${opts.projectCode} — ${opts.projectName}`],
        ['Due',         opts.dueDate ?? 'As soon as possible'],
      ])}
      ${btn('Review & Decide', approvalUrl)}
    `)
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Action Required: ${opts.title} — ${opts.projectCode}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendApprovalRequestEmail failed:', err)
  }
}

export async function sendApprovalDecisionEmail(opts: {
  to: string
  requesterName: string
  title: string
  decision: 'approved' | 'rejected'
  decisionBy: string
  projectCode: string
  reason?: string
  approvalId: string
}) {
  try {
    const resend = getResend()
    const projectUrl = `${BASE_URL}/approvals?id=${opts.approvalId}`
    const isApproved = opts.decision === 'approved'
    const html = wrapHtml(`
      ${heading(`Approval ${isApproved ? 'Approved' : 'Rejected'}`)}
      ${para(`Hi ${opts.requesterName}, your request has been <strong style="color:${isApproved ? '#64ffda' : '#ef4444'}">${opts.decision}</strong>.`)}
      ${kvTable([
        ['Title',     opts.title],
        ['Decision',  opts.decision.toUpperCase()],
        ['Decided by',opts.decisionBy],
        ['Project',   opts.projectCode],
        ...(opts.reason ? [['Reason', opts.reason] as [string, string]] : []),
      ])}
      ${btn('View Details', projectUrl)}
    `)
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Approval ${isApproved ? 'Approved' : 'Rejected'}: ${opts.title}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendApprovalDecisionEmail failed:', err)
  }
}

export async function sendProjectCreatedEmail(opts: {
  to: string
  recipientName: string
  projectCode: string
  projectName: string
  technology: string
  budgetUsd: number
  projectId: string
}) {
  try {
    const resend = getResend()
    const projectUrl = `${BASE_URL}/projects/${opts.projectId}`
    const budget = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(opts.budgetUsd)
    const html = wrapHtml(`
      ${heading('New Project Created')}
      ${para(`Hi ${opts.recipientName}, a new project has been created on GridMind Capital.`)}
      ${kvTable([
        ['Code',       opts.projectCode],
        ['Name',       opts.projectName],
        ['Technology', opts.technology],
        ['Budget',     budget],
      ])}
      ${btn('Open Project', projectUrl)}
    `)
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `New Project: ${opts.projectCode} — ${opts.projectName}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendProjectCreatedEmail failed:', err)
  }
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
  try {
    const resend = getResend()
    const gateUrl = `${BASE_URL}/stage-gates?project=${opts.projectId}`
    const html = wrapHtml(`
      ${heading(`Gate Review Convened: ${opts.gateCode}`)}
      ${para(`A gate review has been convened by <strong style="color:#e6f1ff">${opts.chairName}</strong>.`)}
      ${kvTable([
        ['Gate',     `${opts.gateCode} — ${opts.gateName}`],
        ['Project',  `${opts.projectCode} — ${opts.projectName}`],
        ...(opts.meetingDate ? [['Scheduled', opts.meetingDate] as [string, string]] : []),
      ])}
      ${para('Please review the gate package and prepare your sign-off.')}
      ${btn('Open Gate Review', gateUrl)}
    `)
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Gate Review Convened: ${opts.gateCode} — ${opts.projectCode}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendGateConveneEmail failed:', err)
  }
}

export async function sendDocumentUploadEmail(opts: {
  to: string[]
  uploaderName: string
  fileName: string
  documentCode: string
  projectCode: string
  projectId?: string
}) {
  try {
    const resend = getResend()
    const docUrl = `${BASE_URL}/documents`
    const html = wrapHtml(`
      ${heading('New Document Uploaded')}
      ${para(`<strong style="color:#e6f1ff">${opts.uploaderName}</strong> has uploaded a new document.`)}
      ${kvTable([
        ['Document', opts.documentCode],
        ['File',     opts.fileName],
        ['Project',  opts.projectCode],
      ])}
      ${btn('View Documents', docUrl)}
    `)
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `New Document: ${opts.documentCode} — ${opts.projectCode}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendDocumentUploadEmail failed:', err)
  }
}
