'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import type { AiInsight, MarketplaceProvider, AiMarketplaceDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

export async function loadAiMarketplaceDashboard(): Promise<AiMarketplaceDashboard> {
  const tenantId = await getCurrentTenantId()
  const sb = createAdminClient()
  const [{ data: insights }, { data: providers }, { data: projects }] = await Promise.all([
    sb.from('ai_insights').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    sb.from('marketplace_providers').select('*').eq('tenant_id', tenantId).order('name'),
    sb.from('projects').select('id, name').eq('tenant_id', tenantId),
  ])

  const pm = Object.fromEntries((projects ?? []).map(p => [p.id, p.name]))
  const ins = (insights ?? []).map(r => ({ ...r, project_name: pm[r.project_id] ?? 'Unknown' })) as AiInsight[]
  const prov = (providers ?? []) as MarketplaceProvider[]

  const modMap: Record<string, number> = {}
  const sevMap: Record<string, number> = {}
  for (const r of ins) {
    modMap[r.module] = (modMap[r.module] ?? 0) + 1
    sevMap[r.severity] = (sevMap[r.severity] ?? 0) + 1
  }

  return {
    insights: ins,
    providers: prov,
    insightStats: {
      open:         ins.filter(r => r.status === 'open').length,
      critical:     ins.filter(r => r.severity === 'critical' && r.status === 'open').length,
      acknowledged: ins.filter(r => r.status === 'acknowledged').length,
      resolved:     ins.filter(r => r.status === 'resolved').length,
    },
    byModule:   Object.entries(modMap).map(([module, count]) => ({ module, count })),
    bySeverity: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
  }
}

/**
 * Fire-and-forget: create a high-severity `cost_overrun` AI insight when a
 * project's pending (submitted) VO impact exceeds 5% of its budget_usd.
 *
 * Idempotent guard: only creates a row if there is no existing OPEN cost_overrun
 * insight for the project. Never throws — designed to be called with `void` from
 * inside a read (e.g. getVariationsRegister) as a side effect.
 */
export async function maybeCreateCostOverrunInsight(projectId: string): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const sb = createAdminClient()

    const [{ data: proj }, { data: vos }] = await Promise.all([
      sb.from('projects').select('budget_usd, name').eq('id', projectId).maybeSingle(),
      sb.from('variation_orders').select('cost_impact, status').eq('project_id', projectId).eq('status', 'submitted'),
    ])

    const budget = Number(proj?.budget_usd ?? 0)
    if (budget <= 0) return

    const pendingImpact = (vos ?? []).reduce((s, v) => s + Number((v as { cost_impact?: number }).cost_impact ?? 0), 0)
    const pct = (pendingImpact / budget) * 100
    if (pct <= 5) return

    // Skip if an open cost_overrun insight already exists for this project.
    const { data: existing } = await sb
      .from('ai_insights')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('module', 'cost_overrun')
      .eq('status', 'open')
      .limit(1)
    if (existing && existing.length > 0) return

    const fmt = (n: number) =>
      n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`

    await sb.from('ai_insights').insert({
      tenant_id: tenantId,
      project_id: projectId,
      module: 'cost_overrun',
      title: `Pending variations exceed 5% of budget on ${proj?.name ?? 'project'}`,
      description: `Submitted (pending) variation orders total ${fmt(pendingImpact)}, which is ${pct.toFixed(1)}% of the ${fmt(budget)} project budget. If approved, this materially erodes contingency.`,
      confidence: 90,
      severity: 'high',
      status: 'open',
      recommended_action: 'Review the pending variation orders with the commercial lead. Assess contingency headroom and confirm client cost recovery before approval.',
    })
    revalidatePath('/ai-insights')
  } catch (e) {
    console.error('[ai-insights] cost_overrun generator failed:', e)
  }
}

/**
 * Fire-and-forget: raise a high-severity insight off a freshly generated lender
 * report when performance breaches thresholds — CPI < 0.9 (`cost_overrun`) or
 * SPI < 0.85 (`schedule_risk`). Each module is created at most once per project
 * while an open insight of that module already exists. Never throws.
 */
export async function maybeCreateLenderRiskInsight(
  projectId: string,
  cpi: number,
  spi: number,
): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const sb = createAdminClient()
    const { data: proj } = await sb.from('projects').select('name').eq('id', projectId).maybeSingle()
    const projectName = (proj?.name as string) ?? 'project'

    const candidates: { module: string; title: string; description: string; action: string }[] = []
    if (cpi < 0.9) {
      candidates.push({
        module: 'cost_overrun',
        title: `Cost performance below threshold on ${projectName}`,
        description: `The latest lender report shows a Cost Performance Index (CPI) of ${cpi.toFixed(2)}, below the 0.90 threshold. This indicates the project is running over budget for the work completed to date.`,
        action: 'Review actual costs against earned value with the commercial lead and reforecast the estimate at completion before the next lender submission.',
      })
    }
    if (spi < 0.85) {
      candidates.push({
        module: 'schedule_risk',
        title: `Schedule performance below threshold on ${projectName}`,
        description: `The latest lender report shows a Schedule Performance Index (SPI) of ${spi.toFixed(2)}, below the 0.85 threshold. This indicates the project is materially behind the planned schedule.`,
        action: 'Review the critical path and recovery options with the project manager, and assess exposure to milestone/COD commitments.',
      })
    }
    if (candidates.length === 0) return

    for (const c of candidates) {
      const { data: existing } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', c.module)
        .eq('status', 'open')
        .limit(1)
      if (existing && existing.length > 0) continue

      await sb.from('ai_insights').insert({
        tenant_id: tenantId,
        project_id: projectId,
        module: c.module,
        title: c.title,
        description: c.description,
        confidence: 92,
        severity: 'high',
        status: 'open',
        recommended_action: c.action,
      })
    }
    revalidatePath('/ai-insights')
  } catch (e) {
    console.error('[ai-insights] lender risk generator failed:', e)
  }
}

/**
 * Fire-and-forget PTW safety watchdog, called from getPermitsBoard.
 * Raises ONE high-severity `safety` insight for a project when either:
 *  – any permit is currently suspended, OR
 *  – more than 3 permits expired without closure in the last 7 days.
 * No-ops when a `safety` insight is already open for the project. Never throws.
 */
export async function maybeCreatePermitSafetyInsight(
  projectId: string,
  suspendedCount: number,
  expiredUnclosedLast7d: number,
): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const triggerSuspended = suspendedCount > 0
    const triggerExpired = expiredUnclosedLast7d > 3
    if (!triggerSuspended && !triggerExpired) return

    const sb = createAdminClient()

    const { data: existing } = await sb
      .from('ai_insights')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('module', 'safety')
      .eq('status', 'open')
      .limit(1)
    if (existing && existing.length > 0) return

    const { data: proj } = await sb.from('projects').select('name').eq('id', projectId).maybeSingle()
    const projectName = (proj?.name as string) ?? 'project'

    const reasons: string[] = []
    if (triggerSuspended) reasons.push(`${suspendedCount} permit(s) currently suspended`)
    if (triggerExpired) reasons.push(`${expiredUnclosedLast7d} permits expired without formal closure in the last 7 days`)

    await sb.from('ai_insights').insert({
      tenant_id: tenantId,
      project_id: projectId,
      module: 'safety',
      title: `Permit-to-work compliance risk on ${projectName}`,
      description: `Live PTW monitoring detected ${reasons.join(' and ')}. Uncontrolled or lapsed permits indicate a breakdown in the permit lifecycle and elevate on-site safety exposure.`,
      confidence: 90,
      severity: 'high',
      status: 'open',
      recommended_action: 'Have the HSE manager review the affected permits: reinstate or close suspended permits and ensure every expired permit is formally closed out before work continues.',
    })
    revalidatePath('/ai-insights')
  } catch (e) {
    console.error('[ai-insights] permit safety generator failed:', e)
  }
}

/**
 * Fire-and-forget schedule-risk watchdog, called from getDailyReports.
 * Raises ONE high-severity `schedule_risk` insight for a project when a
 * SUBMITTED daily report records a delay (non-empty `delays`) on 3+ consecutive
 * calendar days. No-ops when a `schedule_risk` insight is already open for the
 * project. Never throws.
 */
export async function maybeCreateDelayInsight(projectId: string): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const sb = createAdminClient()

    // Pull recent submitted reports that actually record a delay.
    const { data: rows } = await sb
      .from('daily_reports')
      .select('report_date, delays')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('status', 'submitted')
      .order('report_date', { ascending: false })
      .limit(60)

    const delayDays = (rows ?? [])
      .filter((r) => typeof r.delays === 'string' && (r.delays as string).trim().length > 0)
      .map((r) => String(r.report_date).slice(0, 10))

    // Detect a run of 3+ consecutive calendar days among the delay dates.
    const daySet = new Set(delayDays)
    const DAY = 86_400_000
    let hasStreak = false
    let streakEnd = ''
    for (const d of daySet) {
      const base = Date.parse(d)
      if (Number.isNaN(base)) continue
      const d1 = new Date(base + DAY).toISOString().slice(0, 10)
      const d2 = new Date(base + 2 * DAY).toISOString().slice(0, 10)
      if (daySet.has(d1) && daySet.has(d2)) { hasStreak = true; streakEnd = d2 > streakEnd ? d2 : streakEnd }
    }
    if (!hasStreak) return

    const { data: existing } = await sb
      .from('ai_insights')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('module', 'schedule_risk')
      .eq('status', 'open')
      .limit(1)
    if (existing && existing.length > 0) return

    const { data: proj } = await sb.from('projects').select('name').eq('id', projectId).maybeSingle()
    const projectName = (proj?.name as string) ?? 'project'

    await sb.from('ai_insights').insert({
      tenant_id: tenantId,
      project_id: projectId,
      module: 'schedule_risk',
      title: `Recurring site delays reported — ${projectName}`,
      description: `Field daily reports logged delays on 3 or more consecutive days (through ${streakEnd}). Sustained day-over-day delays are a leading indicator of schedule slippage and should be reconciled against the programme.`,
      confidence: 82,
      severity: 'high',
      status: 'open',
      recommended_action: 'Review the recent daily reports with the site team, quantify the schedule impact, and update the project programme / critical path accordingly.',
    })
    revalidatePath('/ai-insights')
  } catch (e) {
    console.error('[ai-insights] recurring-delay generator failed:', e)
  }
}

/**
 * Fire-and-forget quality watchdog, called from getItpDashboard.
 * Two independent triggers, each raising ONE insight if not already open:
 *  A) inspection pass rate < 85% with 10+ results → module 'schedule_risk', severity 'high'
 *  B) any critical NCR (source = failed_inspection) open > 7 days → module 'safety', severity 'high'
 * Each trigger checks independently for an existing open insight of that module+project combo.
 * Never throws.
 */
export async function maybeCreateQualityInsight(
  projectId: string,
  passRatePct: number,
  totalResults: number,
  oldestCriticalNcrDays: number,  // 0 if none
): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const sb = createAdminClient()
    const { data: proj } = await sb.from('projects').select('name').eq('id', projectId).maybeSingle()
    const projectName = (proj?.name as string | null) ?? 'project'

    // ── Trigger A: low pass rate ──────────────────────────────────────────
    const triggerPassRate = passRatePct < 85 && totalResults >= 10
    if (triggerPassRate) {
      const { data: existingSchedule } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', 'schedule_risk')
        .eq('status', 'open')
        .limit(1)

      if (!existingSchedule || existingSchedule.length === 0) {
        await sb.from('ai_insights').insert({
          tenant_id: tenantId,
          project_id: projectId,
          module: 'schedule_risk',
          title: `Inspection pass rate below threshold on ${projectName}`,
          description: `ITP inspection pass rate is ${passRatePct}% (threshold: 85%) based on ${totalResults} recorded results. A sustained low pass rate increases rework cycles, delays commissioning, and elevates schedule risk.`,
          confidence: 85,
          severity: 'high',
          status: 'open',
          recommended_action: 'Review failed hold points with the QA/QC lead. Identify root-cause patterns — recurring failures in the same work package may indicate a training or process gap.',
        })
        revalidatePath('/ai-insights')
      }
    }

    // ── Trigger B: critical NCR open > 7 days ────────────────────────────
    const triggerCriticalNcr = oldestCriticalNcrDays > 7
    if (triggerCriticalNcr) {
      const { data: existingSafety } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', 'safety')
        .eq('status', 'open')
        .limit(1)

      if (!existingSafety || existingSafety.length === 0) {
        await sb.from('ai_insights').insert({
          tenant_id: tenantId,
          project_id: projectId,
          module: 'safety',
          title: `Critical NCR unresolved ${oldestCriticalNcrDays} days on ${projectName}`,
          description: `A critical non-conformance (failed inspection category) has been open for ${oldestCriticalNcrDays} days without disposition or closure. Unresolved critical NCRs block mechanical completion gate approvals and indicate a systemic quality control failure.`,
          confidence: 92,
          severity: 'high',
          status: 'open',
          recommended_action: 'Assign root cause investigation immediately. Document disposition (Use As-Is / Repair / Rework / Reject). Escalate to Project Director if closure is not achieved within 48 hours.',
        })
        revalidatePath('/ai-insights')
      }
    }
  } catch (e) {
    console.error('[ai-insights] quality insight generator failed:', e)
  }
}

/**
 * Fire-and-forget contracts watchdog, called from getContractsRegister.
 * Two independent triggers, each raising ONE insight (module 'cost_overrun',
 * severity 'high') if none currently open for the project:
 *  A) total LD exposure > 2% of project budget
 *  B) any security is expired but still status = 'active' for > 7 days
 * Never throws.
 */
export async function maybeCreateContractsInsight(
  projectId: string,
  totalLdExposure: number,
  oldestExpiredSecurityDays: number,  // 0 if none
): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const sb = createAdminClient()
    const { data: proj } = await sb
      .from('projects')
      .select('name, budget_usd')
      .eq('id', projectId)
      .maybeSingle()
    const projectName = (proj?.name as string | null) ?? 'project'
    const budgetUsd   = Number(proj?.budget_usd ?? 0)

    // ── Trigger A: LD exposure > 2% of budget ────────────────────────────
    const ldThreshold = budgetUsd > 0 ? budgetUsd * 0.02 : 0
    const triggerLd   = ldThreshold > 0 && totalLdExposure > ldThreshold
    if (triggerLd) {
      const { data: existing } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', 'cost_overrun')
        .eq('status', 'open')
        .limit(1)

      if (!existing || existing.length === 0) {
        const ldPct = ((totalLdExposure / budgetUsd) * 100).toFixed(1)
        await sb.from('ai_insights').insert({
          tenant_id:  tenantId,
          project_id: projectId,
          module:     'cost_overrun',
          title:      `LD exposure ${ldPct}% of budget on ${projectName}`,
          description: `Liquidated damages have accrued to $${Math.round(totalLdExposure).toLocaleString()}, representing ${ldPct}% of the project budget ($${Math.round(budgetUsd).toLocaleString()}). Threshold is 2%. Continued schedule slip will increase financial exposure and may trigger contract clauses.`,
          confidence: 88,
          severity:   'high',
          status:     'open',
          recommended_action: 'Review milestone status with the Commercial Manager. Identify critical-path delays, assess LD cap position, and initiate EOT claim if delay is excusable. Notify the Project Director if exposure exceeds 5% of budget.',
        })
        revalidatePath('/ai-insights')
      }
    }

    // ── Trigger B: security expired but not released for > 7 days ────────
    const triggerExpiredSecurity = oldestExpiredSecurityDays > 7
    if (triggerExpiredSecurity) {
      const { data: existingSec } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', 'cost_overrun')
        .eq('status', 'open')
        .ilike('title', '%security%')
        .limit(1)

      if (!existingSec || existingSec.length === 0) {
        await sb.from('ai_insights').insert({
          tenant_id:  tenantId,
          project_id: projectId,
          module:     'cost_overrun',
          title:      `Expired security not released on ${projectName}`,
          description: `One or more financial securities (bonds or guarantees) have expired but remain in active status for ${oldestExpiredSecurityDays} days. Expired securities that are not formally released may create incorrect balance-sheet obligations and audit findings.`,
          confidence: 90,
          severity:   'high',
          status:     'open',
          recommended_action: 'Contact the issuing bank to confirm expiry and obtain formal release documentation. Update the securities register to released status. If renewal is required, initiate the bank guarantee renewal process immediately.',
        })
        revalidatePath('/ai-insights')
      }
    }
  } catch (e) {
    console.error('[ai-insights] contracts insight generator failed:', e)
  }
}

/**
 * Fire-and-forget energy production watchdog.
 * Trigger: rolling 7-day actual < 90% of P50 (both must be > 0).
 * Module: 'anomaly_detection', severity: 'high'.
 * Skipped if any open insight of that module+project already exists.
 * Never throws.
 */
export async function maybeCreateEnergyInsight(
  projectId: string,
  rolling7dActual: number,
  rolling7dP50:    number,
): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    if (rolling7dP50 <= 0 || rolling7dActual <= 0) return
    const pct = (rolling7dActual / rolling7dP50) * 100
    if (pct >= 90) return

    const sb = createAdminClient()
    const { data: proj } = await sb
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()
    const projectName = (proj?.name as string | null) ?? 'project'

    const { data: existing } = await sb
      .from('ai_insights')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('module', 'anomaly_detection')
      .eq('status', 'open')
      .limit(1)

    if (existing && existing.length > 0) return

    await sb.from('ai_insights').insert({
      tenant_id:  tenantId,
      project_id: projectId,
      module:     'anomaly_detection',
      title:      `Low production — 7-day yield at ${pct.toFixed(1)}% of P50 on ${projectName}`,
      description: `Rolling 7-day production (${rolling7dActual.toFixed(1)} MWh) is ${pct.toFixed(1)}% of the P50 target (${rolling7dP50.toFixed(1)} MWh). Sustained under-performance below 90% of P50 may indicate inverter faults, soiling, shading, curtailment, or availability issues.`,
      confidence: 85,
      severity:   'high',
      status:     'open',
      recommended_action: 'Review SCADA data for inverter trips, string faults, or clipping. Check curtailment logs and soiling index. Dispatch O&M crew if fault not cleared within 24 hours. Notify the asset manager if under-performance persists for 3+ days.',
    })
    revalidatePath('/ai-insights')
  } catch (e) {
    console.error('[ai-insights] energy insight generator failed:', e)
  }
}

/**
 * Fire-and-forget BESS watchdog.
 * Trigger A: SOH drops > 2% in 30 days → module 'predictive_maintenance', severity 'high'.
 * Trigger B: cycles > 90% of warranty limit → module 'predictive_maintenance', severity 'critical'.
 * Each trigger deduped independently via ilike on title.
 * Never throws.
 */
export async function maybeCreateBessInsight(
  projectId: string,
  sohDrop30d:      number,   // SOH percentage points dropped over last 30 days (positive = drop)
  pctWarrantyUsed: number,   // cycles_used / warranty_limit × 100
): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const sb = createAdminClient()
    const { data: proj } = await sb
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()
    const projectName = (proj?.name as string | null) ?? 'project'

    // ── Trigger A: SOH degradation ───────────────────────────────────────────
    if (sohDrop30d > 2) {
      const { data: existingSoh } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', 'predictive_maintenance')
        .eq('status', 'open')
        .ilike('title', '%SOH%')
        .limit(1)

      if (!existingSoh || existingSoh.length === 0) {
        await sb.from('ai_insights').insert({
          tenant_id:  tenantId,
          project_id: projectId,
          module:     'predictive_maintenance',
          title:      `Rapid BESS SOH degradation — ${sohDrop30d.toFixed(1)}pp drop in 30 days on ${projectName}`,
          description: `State of health has declined by ${sohDrop30d.toFixed(1)} percentage points over the last 30 days. A degradation rate exceeding 2pp per month is above typical calendar-ageing norms and may indicate accelerated capacity fade due to thermal stress, deep cycling, or cell imbalance.`,
          confidence: 82,
          severity:   'high',
          status:     'open',
          recommended_action: 'Request a capacity test from the BESS OEM. Review thermal management logs and recent dispatch profiles. Check BMS cell-level voltage balance. Notify the asset manager and consider reducing depth of discharge limits until investigation is complete.',
        })
        revalidatePath('/ai-insights')
      }
    }

    // ── Trigger B: warranty cycle consumption > 90% ──────────────────────────
    if (pctWarrantyUsed > 90) {
      const { data: existingCycles } = await sb
        .from('ai_insights')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('module', 'predictive_maintenance')
        .eq('status', 'open')
        .ilike('title', '%warranty cycle%')
        .limit(1)

      if (!existingCycles || existingCycles.length === 0) {
        await sb.from('ai_insights').insert({
          tenant_id:  tenantId,
          project_id: projectId,
          module:     'predictive_maintenance',
          title:      `BESS warranty cycle limit at ${pctWarrantyUsed.toFixed(1)}% on ${projectName}`,
          description: `Cumulative cycles have consumed ${pctWarrantyUsed.toFixed(1)}% of the contractual warranty cycle limit. Exceeding the limit may void the OEM warranty and require early battery replacement or an extended-warranty negotiation.`,
          confidence: 95,
          severity:   'critical',
          status:     'open',
          recommended_action: 'Contact the BESS OEM to initiate warranty extension or replacement planning. Reduce cycling depth and frequency to extend remaining warranty life. Escalate to Project Director and Finance Manager for budget provisioning.',
        })
        revalidatePath('/ai-insights')
      }
    }
  } catch (e) {
    console.error('[ai-insights] BESS insight generator failed:', e)
  }
}

export async function acknowledgeInsightAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('ai_insights').update({ status: 'acknowledged' }).eq('id', id)
  revalidatePath('/ai-insights')
  return { error: error?.message ?? null }
}

export async function dismissInsightAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('ai_insights').update({ status: 'dismissed' }).eq('id', id)
  revalidatePath('/ai-insights')
  return { error: error?.message ?? null }
}

export async function connectProviderAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('marketplace_providers').update({ status: 'connected' }).eq('id', id)
  revalidatePath('/marketplace')
  return { error: error?.message ?? null }
}

export async function seedAiMarketplaceDemoAction() {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return { seeded: false }

  const sb = createAdminClient()
  const { data: existing } = await sb.from('ai_insights').select('id').eq('tenant_id', tenantId).limit(1)
  if (existing && existing.length > 0) return { seeded: false }

  const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', tenantId).limit(1)
  const pid = projects?.[0]?.id
  // No hardcoded fallback id: project_id is a FK, so seeding against a
  // nonexistent project would fail. Bail out instead.
  if (!pid) return { seeded: false }

  const insightRows = [
    { module: 'predictive_maintenance', title: 'Inverter A2 showing early degradation', description: 'SCADA data indicates 12% efficiency loss vs baseline. Probability of failure in 60 days: 73%.', confidence: 87, severity: 'critical', status: 'open', recommended_action: 'Schedule inspection within 2 weeks. Pre-order replacement IGBT module.' },
    { module: 'anomaly_detection', title: 'String 7 IV curve deviation detected', description: 'DC string output deviating >8% from expected model. Possible shading event or cell degradation.', confidence: 92, severity: 'high', status: 'open', recommended_action: 'Dispatch field technician for visual inspection and thermal imaging.' },
    { module: 'schedule_risk', title: 'G2 Engineering milestone at risk', description: 'IFC drawing submission rate 18% behind plan. Extrapolated to 3-week delay to G3 gate.', confidence: 78, severity: 'high', status: 'acknowledged', recommended_action: 'Review drawing register with EPC PM. Consider additional draughtsman resource.' },
    { module: 'cost_overrun', title: 'Procurement costs trending 4.2% above budget', description: 'MV cable pricing has increased 9% since budget set. EAC impact: +$1.3M.', confidence: 85, severity: 'medium', status: 'open', recommended_action: 'Lock in pricing with alternative suppliers. Review value engineering options.' },
    { module: 'safety', title: 'HSE leading indicator — near-miss frequency trending up', description: '3 near-miss reports in 5 days. Statistically significant increase. Historical pattern precedes LTI.', confidence: 81, severity: 'high', status: 'open', recommended_action: 'Convene toolbox talk. Review permits to work for high-risk activities this week.' },
    { module: 'predictive_maintenance', title: 'Transformer T1 oil temperature elevated', description: 'Operating at 78°C vs 65°C design point. Load-side investigation recommended.', confidence: 76, severity: 'medium', status: 'resolved', recommended_action: 'Reduce load during peak hours. Sample oil for DGA analysis.' },
  ]

  await sb.from('ai_insights').insert(
    insightRows.map(r => ({ ...r, project_id: pid, tenant_id: tenantId }))
  )

  const providerRows = [
    { name: 'TomKimi AI Copilot', category: 'analytics', description: 'AI copilot for project risk, schedule, and portfolio intelligence.', logo_url: null, integration_type: 'api', status: 'connected', rating: 4.9, review_count: 58 },
    { name: 'SolarEdge Monitoring API', category: 'data_feed', description: 'Real-time inverter telemetry, string-level data and alerts.', logo_url: null, integration_type: 'api', status: 'connected', rating: 4.7, review_count: 312 },
    { name: 'Meteomatics Weather', category: 'data_feed', description: 'High-resolution solar irradiance and weather forecasts.', logo_url: null, integration_type: 'api', status: 'available', rating: 4.5, review_count: 189 },
    { name: 'DNV GL Energy Analytics', category: 'analytics', description: 'P50/P90 energy yield assessment and performance benchmarking.', logo_url: null, integration_type: 'oauth', status: 'available', rating: 4.8, review_count: 94 },
    { name: 'Procore Construction PM', category: 'epc_tool', description: 'Construction management, RFIs, submittals, and punch lists.', logo_url: null, integration_type: 'api', status: 'pending', rating: 4.3, review_count: 1420 },
    { name: 'Enertiv Building Analytics', category: 'analytics', description: 'Energy consumption benchmarking and anomaly detection.', logo_url: null, integration_type: 'webhook', status: 'available', rating: 4.1, review_count: 67 },
    { name: 'SAP ERP Finance Bridge', category: 'finance', description: 'Bi-directional sync of POs, invoices, and commitment data.', logo_url: null, integration_type: 'api', status: 'available', rating: 4.0, review_count: 203 },
    { name: 'Fieldwire Site Inspection', category: 'field_service', description: 'Mobile punch list and inspection management for field teams.', logo_url: null, integration_type: 'api', status: 'available', rating: 4.6, review_count: 578 },
    { name: 'ISO 14001 Compliance Hub', category: 'compliance', description: 'Environmental management system compliance tracking and reporting.', logo_url: null, integration_type: 'file_import', status: 'available', rating: 3.9, review_count: 42 },
  ]

  await sb.from('marketplace_providers').insert(
    providerRows.map(r => ({ ...r, tenant_id: tenantId }))
  )

  revalidatePath('/ai-insights')
  return { seeded: true }
}
