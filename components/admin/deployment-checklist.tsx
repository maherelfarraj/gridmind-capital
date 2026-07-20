'use client'

import * as React from 'react'
import {
  Check,
  Circle,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight,
  Terminal,
  Globe,
  Key,
  FolderOpen,
  Download,
  Layers,
  Database,
  Sprout,
  Play,
  Rocket,
  ClipboardList,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/* ── Types ─────────────────────────────────── */
type StepStatus = 'done' | 'active' | 'pending'

interface Step {
  id: number
  action: string
  command: string | null
  href: string | null
  icon: React.ElementType
  category: 'external' | 'terminal' | 'manual' | 'tool'
  detail: string
}

/* ── Step definitions ─────────────────────── */
const STEPS: Step[] = [
  {
    id: 1,
    action: 'Create Supabase project',
    command: null,
    href: 'https://supabase.com',
    icon: Globe,
    category: 'external',
    detail: 'Sign in to Supabase and create a new project. Choose a region close to your users and set a strong database password.',
  },
  {
    id: 2,
    action: 'Get URL + keys',
    command: null,
    href: null,
    icon: Key,
    category: 'manual',
    detail: 'In the Supabase Dashboard go to Settings → API. Copy the Project URL and both anon/service_role keys — you will need them in step 8.',
  },
  {
    id: 3,
    action: 'Create Next.js project',
    command: 'npx create-next-app@latest gridmind-capital --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"',
    href: null,
    icon: Terminal,
    category: 'terminal',
    detail: 'Scaffold the Next.js 14+ App Router project. The flags enable TypeScript, Tailwind CSS, ESLint, the App directory, a src/ layout, and the @/* import alias.',
  },
  {
    id: 4,
    action: 'Copy all source files',
    command: null,
    href: null,
    icon: FolderOpen,
    category: 'manual',
    detail: 'Paste all component files from /mnt/agents/output/gridmind-capital/ into the project. Preserve the directory structure exactly.',
  },
  {
    id: 5,
    action: 'Install dependencies',
    command: 'npm install',
    href: null,
    icon: Download,
    category: 'terminal',
    detail: 'Install all npm packages declared in package.json. This includes Supabase client, shadcn/ui, Recharts, and all other project dependencies.',
  },
  {
    id: 6,
    action: 'Run v0 Prompt 1',
    command: null,
    href: 'https://v0.dev',
    icon: Layers,
    category: 'tool',
    detail: 'Open v0.dev, paste the first prompt, export the generated code, and paste it into the project. This establishes the design system foundation.',
  },
  {
    id: 7,
    action: 'Continue v0 Prompts 2–15',
    command: null,
    href: 'https://v0.dev',
    icon: Layers,
    category: 'tool',
    detail: 'Work through each remaining v0 prompt one by one. Export and integrate each component before proceeding to the next prompt.',
  },
  {
    id: 8,
    action: 'Add Supabase env vars',
    command: '# Copy to .env.local:\nNEXT_PUBLIC_SUPABASE_URL=your_project_url\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key\nSUPABASE_SERVICE_ROLE_KEY=your_service_role_key',
    href: null,
    icon: Key,
    category: 'manual',
    detail: 'Create a .env.local file at the project root and paste the three Supabase environment variables from step 2. Never commit this file to git.',
  },
  {
    id: 9,
    action: 'Push database schema',
    command: 'npx supabase db push',
    href: null,
    icon: Database,
    category: 'terminal',
    detail: 'Run the Supabase CLI to push all migration files to your project database. Ensure you are authenticated with `npx supabase login` first.',
  },
  {
    id: 10,
    action: 'Run seed',
    command: 'npm run db:seed',
    href: null,
    icon: Sprout,
    category: 'terminal',
    detail: 'Populate the database with demo data including the default tenant, stage-gate definitions, sample projects, users, and workflow configurations.',
  },
  {
    id: 11,
    action: 'Start dev server',
    command: 'npm run dev',
    href: null,
    icon: Play,
    category: 'terminal',
    detail: 'Start the Next.js development server on http://localhost:3000. Verify the app loads and you can sign in with the seeded demo credentials.',
  },
  {
    id: 12,
    action: 'Deploy to Vercel',
    command: 'vercel --prod',
    href: null,
    icon: Rocket,
    category: 'terminal',
    detail: 'Deploy the production build to Vercel. Ensure all environment variables are configured in the Vercel project settings before deploying.',
  },
]

/* ── Category config ──────────────────────── */
const CATEGORY_CONFIG = {
  external: { label: 'Browser', color: 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25' },
  terminal: { label: 'Terminal', color: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25' },
  manual:   { label: 'Manual',   color: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25' },
  tool:     { label: 'v0.dev',   color: 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30' },
} as const

/* ── Copy-to-clipboard hook ───────────────── */
function useCopyToClipboard() {
  const [copied, setCopied] = React.useState<number | null>(null)
  const copy = React.useCallback((text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])
  return { copied, copy }
}

/* ── StepRow ──────────────────────────────── */
function StepRow({
  step,
  status,
  expanded,
  onToggle,
  onMarkDone,
  onMarkPending,
  copied,
  onCopy,
}: {
  step: Step
  status: StepStatus
  expanded: boolean
  onToggle: () => void
  onMarkDone: () => void
  onMarkPending: () => void
  copied: number | null
  onCopy: (text: string, id: number) => void
}) {
  const Icon = step.icon
  const cat = CATEGORY_CONFIG[step.category]
  const isDone = status === 'done'
  const isActive = status === 'active'

  return (
    <div
      className={cn(
        'group border rounded-xl transition-all duration-200',
        isDone
          ? 'border-[#22c55e]/20 bg-[#22c55e]/5 dark:bg-[#22c55e]/5'
          : isActive
          ? 'border-[#64ffda]/30 bg-[#64ffda]/5 dark:bg-[#64ffda]/5 shadow-[0_0_0_1px_rgba(100,255,218,0.15)]'
          : 'border-border bg-card hover:border-border/80',
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 px-4 py-3">

        {/* Step number / status node */}
        <button
          onClick={isDone ? onMarkPending : onMarkDone}
          aria-label={isDone ? `Mark step ${step.id} as pending` : `Mark step ${step.id} as done`}
          className={cn(
            'shrink-0 size-8 rounded-full flex items-center justify-center',
            'border-2 transition-all duration-200 focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isDone
              ? 'bg-[#22c55e] border-[#22c55e] text-white'
              : isActive
              ? 'bg-[#64ffda]/10 border-[#64ffda] text-[#64ffda]'
              : 'bg-card border-border text-muted-foreground hover:border-[#64ffda]/50',
          )}
        >
          {isDone ? (
            <Check className="size-4" strokeWidth={2.5} />
          ) : (
            <span className="text-xs font-semibold font-mono">{step.id}</span>
          )}
        </button>

        {/* Icon + action */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Icon
            className={cn(
              'size-4 shrink-0',
              isDone ? 'text-[#22c55e]/60' : isActive ? 'text-[#64ffda]' : 'text-muted-foreground',
            )}
          />
          <span
            className={cn(
              'text-sm font-medium truncate',
              isDone ? 'line-through text-muted-foreground' : 'text-foreground',
            )}
          >
            {step.action}
          </span>
        </div>

        {/* Category badge */}
        <span
          className={cn(
            'hidden sm:inline-flex items-center rounded-md px-2 py-0.5',
            'text-[11px] font-medium border shrink-0',
            cat.color,
          )}
        >
          {cat.label}
        </span>

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} step ${step.id} details`}
          className="shrink-0 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {expanded
            ? <ChevronDown className="size-4" />
            : <ChevronRight className="size-4" />}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0 space-y-3 animate-[fade-in_0.15s_ease-out]">
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">
            {step.detail}
          </p>

          {/* Command block */}
          {step.command && (
            <div className="relative group/code">
              <pre className={cn(
                'text-xs font-mono leading-relaxed rounded-lg px-4 py-3 pr-12 overflow-x-auto',
                'bg-[#0d1f3c] text-[#ccd6f6] border border-[#64ffda]/15',
                'dark:bg-[#060f1d] dark:text-[#ccd6f6]',
              )}>
                {step.command}
              </pre>
              <button
                onClick={() => onCopy(step.command!, step.id)}
                aria-label="Copy command"
                className={cn(
                  'absolute top-2.5 right-2.5 size-7 rounded-md flex items-center justify-center transition-all',
                  'bg-[#64ffda]/10 hover:bg-[#64ffda]/20 text-[#64ffda] border border-[#64ffda]/20',
                )}
              >
                {copied === step.id
                  ? <Check className="size-3.5" />
                  : <Copy className="size-3.5" />}
              </button>
            </div>
          )}

          {/* External link */}
          {step.href && (
            <a
              href={step.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64ffda] hover:text-[#64ffda]/80 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Open {step.href}
            </a>
          )}

          {/* Mark done / undo */}
          <div className="flex items-center gap-2 pt-1">
            {isDone ? (
              <Button size="sm" variant="ghost" onClick={onMarkPending} className="text-muted-foreground h-7 text-xs gap-1.5">
                <RefreshCw className="size-3" />
                Mark as pending
              </Button>
            ) : (
              <Button size="sm" variant="success" onClick={onMarkDone} className="h-7 text-xs gap-1.5">
                <Check className="size-3.5" />
                Mark as done
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Progress bar ─────────────────────────── */
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{done} of {total} steps complete</span>
        <span className={cn(
          'font-semibold font-mono',
          pct === 100 ? 'text-[#22c55e]' : 'text-[#64ffda]',
        )}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-[#22c55e]' : 'bg-[#64ffda]',
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

/* ── Main component ───────────────────────── */
export interface DeploymentChecklistProps {
  initialDone?: number[]
}

export function DeploymentChecklist({ initialDone = [] }: DeploymentChecklistProps) {
  const [done, setDone] = React.useState<Set<number>>(new Set(initialDone))
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set([1]))
  const { copied, copy } = useCopyToClipboard()

  const doneCount = done.size
  const isComplete = doneCount === STEPS.length

  // Derive active step = first non-done step
  const activeStep = STEPS.find(s => !done.has(s.id))?.id ?? null

  function getStatus(id: number): StepStatus {
    if (done.has(id)) return 'done'
    if (id === activeStep) return 'active'
    return 'pending'
  }

  function markDone(id: number) {
    setDone(prev => new Set([...prev, id]))
    // Auto-expand next step
    const next = STEPS.find(s => s.id > id && !done.has(s.id))
    if (next) setExpanded(prev => new Set([...prev, next.id]))
  }

  function markPending(id: number) {
    setDone(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function toggleExpanded(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(STEPS.map(s => s.id)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  function resetAll() {
    setDone(new Set())
    setExpanded(new Set([1]))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                Deployment Checklist
              </h1>
              <p className="text-xs text-muted-foreground">
                GridMind Capital · 12 steps to production
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={expandAll} className="text-xs h-7 hidden sm:flex">
            Expand all
          </Button>
          <Button size="sm" variant="ghost" onClick={collapseAll} className="text-xs h-7 hidden sm:flex">
            Collapse
          </Button>
          <Button size="sm" variant="outline" onClick={resetAll} className="text-xs h-7 gap-1.5">
            <RefreshCw className="size-3" />
            Reset
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <ProgressBar done={doneCount} total={STEPS.length} />
      </div>

      {/* Completion banner */}
      {isComplete && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e] animate-[fade-in_0.2s_ease-out]">
          <Rocket className="size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">All steps complete — ready to deploy!</p>
            <p className="text-xs opacity-75">GridMind Capital is configured and ready for production.</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground font-medium mr-1">Step type:</span>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <span
            key={key}
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border',
              cfg.color,
            )}
          >
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-2" role="list" aria-label="Deployment steps">
        {STEPS.map(step => (
          <div key={step.id} role="listitem">
            <StepRow
              step={step}
              status={getStatus(step.id)}
              expanded={expanded.has(step.id)}
              onToggle={() => toggleExpanded(step.id)}
              onMarkDone={() => markDone(step.id)}
              onMarkPending={() => markPending(step.id)}
              copied={copied}
              onCopy={copy}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-6">
        <span>{STEPS.length - doneCount} steps remaining</span>
        <span className="font-mono">{doneCount}/{STEPS.length} done</span>
      </div>
    </div>
  )
}
