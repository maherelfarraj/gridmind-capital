'use client'

import * as React from 'react'
import useSWR from 'swr'
import { LayoutTemplate, ChevronDown, CheckCircle2, Loader2, Star, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGateTemplates, type GateTemplate } from '@/app/actions/gate-templates'

/* Owner-role label colors (light + dark) */
const ROLE_STYLES: Record<string, string> = {
  Engineering:        'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  Construction:       'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  'Supply Chain':     'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  Financial:          'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  Legal:              'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  'QA/QC':            'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
  HSE:                'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  Commercial:         'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  PM:                 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  'Document Control': 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
}

function RoleChip({ role }: { role: string }) {
  const style = ROLE_STYLES[role] ?? 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium', style)}>
      {role}
    </span>
  )
}

function TemplateCard({ template }: { template: GateTemplate }) {
  const [open, setOpen] = React.useState(template.is_default)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 dark:hover:bg-accent/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center justify-center size-10 rounded-lg bg-[#0a192f]/5 dark:bg-[#64ffda]/10 shrink-0">
          <LayoutTemplate className="size-5 text-[#0a192f] dark:text-[#64ffda]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground truncate">{template.name}</h3>
            {template.is_default && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <Star className="size-3" /> Default
              </span>
            )}
            {template.technology && (
              <span className="rounded-md bg-slate-100 dark:bg-muted px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-muted-foreground">
                {template.technology}
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-foreground">{template.gates.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-muted-foreground">Gates</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-foreground">{template.deliverable_count}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-muted-foreground">Deliverables</p>
          </div>
          <ChevronDown className={cn('size-5 text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-border divide-y divide-slate-100 dark:divide-border">
          {template.gates.map((gate) => (
            <div key={gate.gate} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center size-7 rounded-full bg-[#0a192f] dark:bg-[#64ffda] text-white dark:text-[#0a192f] text-xs font-bold shrink-0">
                  {gate.gate}
                </span>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-foreground">{gate.title}</h4>
                <span className="text-xs text-slate-400 dark:text-muted-foreground ml-auto">
                  {gate.deliverables.length} {gate.deliverables.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <ul className="space-y-1.5 pl-1">
                {gate.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <FileCheck className="size-4 text-slate-300 dark:text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-foreground flex-1">{d.name}</span>
                    <RoleChip role={d.owner_role} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GateTemplatesPage() {
  const { data: templates, isLoading } = useSWR('gate-templates-admin', () => getGateTemplates(false))

  const list = templates ?? []
  const totalDeliverables = list.reduce((sum, t) => sum + t.deliverable_count, 0)

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-foreground">Gate Templates</h1>
          {!isLoading && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3" /> Live
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">
          Reusable stage-gate deliverable checklists. Active templates are offered as options in the Project Creation Wizard,
          and each deliverable carries a suggested default owner role.
        </p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Templates', value: list.length },
          { label: 'Active', value: list.filter((t) => t.is_active).length },
          { label: 'Deliverables', value: totalDeliverables },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card p-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{k.value}</p>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading templates…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-border p-12 text-center">
          <LayoutTemplate className="size-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-muted-foreground">No gate templates configured yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  )
}
