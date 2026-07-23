import type { NcrStatus, NcrSource } from '@/app/actions/ncrs'

export const NCR_STATUS_LABEL: Record<NcrStatus, string> = {
  open: 'Open',
  in_rectification: 'In Rectification',
  re_inspection: 'Re-inspection',
  closed: 'Closed',
}

/** Tailwind classes for status badges (light + dark). */
export const NCR_STATUS_BADGE: Record<NcrStatus, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  in_rectification: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  re_inspection: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

export const NCR_SOURCE_LABEL: Record<NcrSource, string> = {
  failed_inspection: 'Failed Inspection',
  audit: 'Audit',
  site_observation: 'Site Observation',
}

export const NCR_STEPS: { key: NcrStatus; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_rectification', label: 'In Rectification' },
  { key: 're_inspection', label: 'Re-inspection' },
  { key: 'closed', label: 'Closed' },
]

export function ncrStepIndex(status: NcrStatus): number {
  return NCR_STEPS.findIndex((s) => s.key === status)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
