'use client'
import * as React from 'react'
import { FileText, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_CHARTER, STATUS_META } from './data'
import type { G0FormData } from '@/app/actions/gate-submissions'

export function CharterTab({ formData }: { formData?: G0FormData | null }) {
  // Merge real form data over mock — only override fields present in the intake form
  const base = MOCK_CHARTER
  const c = formData ? {
    ...base,
    project_code:        formData.opportunityCode  || base.project_code,
    project_name:        formData.opportunityName  || base.project_name,
    technology:          formData.technologyType   || formData.technology  || base.technology,
    capacity_mw:         parseFloat(formData.estimatedCapacityMw || formData.capacityMwp || '') || base.capacity_mw,
    location:            formData.siteLocation     || base.location,
    country:             formData.hostCountry      || base.country,
    client:              formData.clientName       || base.client,
    sponsor:             formData.projectSponsor   || base.sponsor,
    description:         formData.description      || base.description,
    capex_estimate_usd:  parseFloat(formData.capexEstimateUsd || formData.budgetMax || '') || base.capex_estimate_usd,
    target_irr_pct:      parseFloat(formData.targetIrrPct || formData.expectedIrr || '') || base.target_irr_pct,
  } : base
  const meta = STATUS_META[c.status]
  const [showScope, setShowScope] = React.useState(true)

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{c.project_code}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}>
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border">{c.version}</span>
          </div>
          <h2 className="text-lg font-bold text-foreground">{c.project_name}</h2>
          <p className="text-sm text-muted-foreground">{c.technology} · {c.capacity_mw} MWp · {c.location}</p>
        </div>
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors whitespace-nowrap self-start">
          <Edit3 className="size-3.5" /> Edit Charter
        </button>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'CAPEX (USD)', value: `$${(c.capex_estimate_usd / 1_000_000).toFixed(0)}M` },
          { label: 'Target IRR', value: `${c.target_irr_pct}%` },
          { label: 'DSCR', value: `${c.target_dscr}x` },
          { label: 'Duration', value: `${c.project_duration_months}m` },
          { label: 'FID Target', value: c.fid_target },
          { label: 'COD Target', value: c.cod_target },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
            <p className="text-lg font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Description + strategic rationale */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Project Description</p>
          <p className="text-sm text-foreground leading-relaxed">{c.description}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Strategic Rationale</p>
          <p className="text-sm text-foreground leading-relaxed">{c.strategic_rationale}</p>
        </div>
      </div>

      {/* Scope / Assumptions / Constraints */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button type="button" onClick={() => setShowScope(!showScope)}
          className="w-full flex items-center justify-between px-5 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
          <span className="text-sm font-semibold text-foreground">Scope, Assumptions & Constraints</span>
          {showScope ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>
        {showScope && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
            {[
              { title: 'Scope Included', items: c.scope_included,  icon: CheckCircle,    color: '#22c55e' },
              { title: 'Scope Excluded', items: c.scope_excluded,  icon: AlertTriangle,  color: '#ef4444' },
              { title: 'Assumptions',    items: c.assumptions,     icon: Clock,          color: '#3b82f6' },
              { title: 'Constraints',    items: c.constraints,     icon: AlertTriangle,  color: '#f59e0b' },
            ].map(({ title, items, icon: Icon, color }) => (
              <div key={title} className="bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="size-4" style={{ color }} />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
                </div>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 size-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
