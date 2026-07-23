import type { VoOrigin, VoStatus } from '@/app/actions/variation-orders'

export const ORIGIN_LABELS: Record<VoOrigin, string> = {
  ifc_discrepancy: 'IFC Discrepancy',
  client_request: 'Client Request',
  site_condition: 'Site Condition',
}

export const STATUS_LABELS: Record<VoStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

/** Hex accents aligned with the app's dark palette (teal primary). */
export const STATUS_COLORS: Record<VoStatus, string> = {
  draft: '#94a3b8',
  submitted: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  withdrawn: '#64748b',
}

export function formatUsd(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(v)
}

export function formatUsdCompact(v: number | null | undefined): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
