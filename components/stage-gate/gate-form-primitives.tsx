'use client'

/**
 * Shared primitives for the G2–G7 gate submission forms.
 * Mirrors the card layout + styling of g1-development-form.tsx so every
 * gate form looks and behaves consistently.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const inputCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition'
export const selectCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition'
export const textareaCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition resize-y min-h-[72px]'

export function Section({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center gap-3">
        <div className="size-8 rounded-lg bg-[#64ffda]/10 flex items-center justify-center shrink-0">
          <Icon className="size-4 text-[#64ffda]" aria-hidden />
        </div>
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function Field({
  label, required, children, hint, error,
}: { label: string; required?: boolean; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}{required && <span className="text-red-400 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-red-500" role="alert">{error}</p>}
    </div>
  )
}

export function GateFormHeader({
  gate, subtitle, projectCode, projectName, description,
}: { gate: string; subtitle: string; projectCode: string; projectName: string; description: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-bold text-[#64ffda] bg-[#64ffda]/10 px-2 py-0.5 rounded">{gate}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <h2 className="text-xl font-bold text-foreground">{projectCode} — {projectName}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export function SuccessCard({
  gate, projectId, onReset,
}: { gate: string; projectId: string; onReset: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg className="size-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{gate} Submission Sent for Approval</h3>
          <p className="text-sm text-muted-foreground mt-1">The submission has been saved and an approval request created.</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href={`/projects/${projectId}`} className="px-4 py-2 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white text-sm font-semibold hover:opacity-90 transition">
            View Project
          </a>
          <button type="button" onClick={onReset} className={cn('px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition')}>
            Edit Submission
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
