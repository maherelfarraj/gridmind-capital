import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* ── Shared base ─────────────────────────────── */
const badgeBase = [
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5',
  'font-sans text-xs font-medium leading-none whitespace-nowrap',
  'border border-transparent',
  'transition-colors duration-150',
].join(' ')

/* ── Main variant set ────────────────────────── */
const badgeVariants = cva(badgeBase, {
  variants: {
    variant: {
      default:
        'bg-primary/10 text-primary border-primary/20',
      secondary:
        'bg-secondary text-secondary-foreground',
      outline:
        'border-border text-foreground bg-transparent',

      /* ── Status ── */
      draft:
        'bg-[#94a3b8]/15 text-[#94a3b8] border-[#94a3b8]/25',
      submitted:
        'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25',
      'under-review':
        'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25',
      approved:
        'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25',
      rejected:
        'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/25',
      escalated:
        'bg-[#ec4899]/15 text-[#ec4899] border-[#ec4899]/25',

      /* ── Priority ── */
      critical:
        'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30 font-semibold',
      high:
        'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30',
      medium:
        'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30',
      low:
        'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
      info:
        'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30',

      /* ── Phase ── */
      intake:
        'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/25',
      commercial:
        'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25',
      engineering:
        'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/25',
      procurement:
        'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/25',
      construction:
        'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/25',
      commissioning:
        'bg-[#14b8a6]/15 text-[#14b8a6] border-[#14b8a6]/25',
      om:
        'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25',
      finance:
        'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25',
      'ai-analytics':
        'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/25',

      /* ── Gate accent ── */
      gate:
        'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30 font-mono text-[11px] tracking-wider',
    },
    dot: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    dot: false,
  },
})

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant = 'default', dot, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, dot }), className)}
      {...props}
    >
      {dot && (
        <span
          className="inline-block size-1.5 rounded-full bg-current opacity-80 shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

/* ── Convenience typed exports ───────────────── */
type StatusVariant = 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected' | 'escalated'
type PriorityVariant = 'critical' | 'high' | 'medium' | 'low' | 'info'
type PhaseVariant = 'intake' | 'commercial' | 'engineering' | 'procurement' | 'construction' | 'commissioning' | 'om' | 'finance' | 'ai-analytics'

function StatusBadge({ status, ...props }: Omit<BadgeProps, 'variant'> & { status: StatusVariant }) {
  const labels: Record<StatusVariant, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    'under-review': 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    escalated: 'Escalated',
  }
  return (
    <Badge variant={status} dot {...props}>
      {labels[status]}
    </Badge>
  )
}

function PriorityBadge({ priority, ...props }: Omit<BadgeProps, 'variant'> & { priority: PriorityVariant }) {
  const labels: Record<PriorityVariant, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
  }
  return (
    <Badge variant={priority} {...props}>
      {labels[priority]}
    </Badge>
  )
}

function PhaseBadge({ phase, ...props }: Omit<BadgeProps, 'variant'> & { phase: PhaseVariant }) {
  const labels: Record<PhaseVariant, string> = {
    intake: 'Intake',
    commercial: 'Commercial',
    engineering: 'Engineering',
    procurement: 'Procurement',
    construction: 'Construction',
    commissioning: 'Commissioning',
    om: 'O&M',
    finance: 'Finance',
    'ai-analytics': 'AI & Analytics',
  }
  return (
    <Badge variant={phase} {...props}>
      {labels[phase]}
    </Badge>
  )
}

export { Badge, badgeVariants, StatusBadge, PriorityBadge, PhaseBadge }
export type { StatusVariant, PriorityVariant, PhaseVariant }
