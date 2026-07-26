import { redirect } from 'next/navigation'

/**
 * Retired route — kept only so existing bookmarks and emailed links resolve.
 *
 * This page rendered a G1-specific approval workflow in which the approver
 * list, deliverables checklist and audit trail were all hardcoded demo
 * constants (DEMO_APPROVERS / DEMO_DELIVERABLES / DEMO_AUDIT plus a hardcoded
 * CURRENT_USER). The project header was fabricated too — "Solar PV", 400 MW,
 * "KSA / NEOM Region" and a $380m capex fallback were shown for whatever
 * approval id you opened.
 *
 * Retired rather than wired up to real data because:
 *
 *  1. Nothing in the app ever linked here — every approval click goes to
 *     `/approvals/[id]`. It was reachable only by typing the URL.
 *  2. The multi-signer model it displayed has no backing on the `approvals`
 *     row (`getApprovalById` selects a single row, no signer join). The real
 *     one is `gate_signoffs -> phase_gates`, which `/team/gates` already
 *     renders, so feeding this page real data would have duplicated that flow.
 *  3. `canDecide` was computed from the hardcoded user and so was true for
 *     every visitor, showing an approve/reject form that always failed the
 *     server-side `requireAssignedApprover` check on submit.
 *
 * `/approvals/[id]` is keyed on the same approval id and renders the live row,
 * so the id forwards cleanly.
 */
export default async function G1ApprovalDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/approvals/${encodeURIComponent(id)}`)
}
