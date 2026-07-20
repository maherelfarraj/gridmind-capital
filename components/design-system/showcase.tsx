'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Badge,
  StatusBadge,
  PriorityBadge,
  PhaseBadge,
} from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

/* ── Section wrapper ─────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#64ffda]">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  )
}

/* ── Token swatch ────────────────────────────── */
function Swatch({ label, color, textColor = 'white' }: { label: string; color: string; textColor?: string }) {
  return (
    <div
      className="flex h-16 flex-col items-start justify-end rounded-lg p-3 ring-1 ring-border/50"
      style={{ background: color }}
    >
      <span className="font-mono text-[10px] leading-tight" style={{ color: textColor }}>
        {label}
      </span>
    </div>
  )
}

/* ── Main showcase ───────────────────────────── */
export function DesignSystemShowcase() {
  const { toast } = useToast()
  const [inputVal, setInputVal] = React.useState('')
  const [selectVal, setSelectVal] = React.useState('')

  const fireToast = (variant: Parameters<typeof toast>[0]['variant']) => {
    const map = {
      default:  { title: 'Update available', description: 'A new version of GridMind is ready to install.' },
      success:  { title: 'Gate approved', description: 'G4 — Construction stage gate signed off by PM.' },
      warning:  { title: 'Deadline approaching', description: 'Permit submission due in 3 days.' },
      danger:   { title: 'Sync failed', description: 'Oracle integration lost connection. Check credentials.' },
      info:     { title: 'Review assigned', description: 'You have been assigned to review RFI-0042.' },
      gate:     { title: 'Gate convened', description: 'G6 Commissioning review has been opened.' },
    }
    const { title, description } = map[variant ?? 'default']
    toast({ variant, title, description, duration: 5000, action: { label: 'View', onClick: () => {} } })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#64ffda]/10 ring-1 ring-[#64ffda]/30">
              <svg className="size-4 text-[#64ffda]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
              </svg>
            </div>
            <div>
              <p className="font-sans text-sm font-semibold text-foreground">GridMind Capital</p>
              <p className="font-mono text-[10px] text-muted-foreground">Design System v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gate">EPC Platform</Badge>
            <Badge variant="approved" dot>Live</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-6 py-12">

        {/* ── Brand Colors ── */}
        <Section title="Brand Colors">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Swatch label="#0a192f — Navy" color="#0a192f" />
            <Swatch label="#112240 — Navy Light" color="#112240" />
            <Swatch label="#1e3a5f — Navy Muted" color="#1e3a5f" />
            <Swatch label="#64ffda — Accent" color="#64ffda" textColor="#0a192f" />
            <Swatch label="#ccd6f6 — Slate" color="#ccd6f6" textColor="#0a192f" />
            <Swatch label="#8892b0 — Muted" color="#8892b0" textColor="#0a192f" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Swatch label="Status: Draft" color="#94a3b8" textColor="#fff" />
            <Swatch label="Submitted" color="#f59e0b" textColor="#fff" />
            <Swatch label="Under Review" color="#3b82f6" textColor="#fff" />
            <Swatch label="Approved" color="#22c55e" textColor="#fff" />
            <Swatch label="Rejected" color="#ef4444" textColor="#fff" />
            <Swatch label="Escalated" color="#ec4899" textColor="#fff" />
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography">
          <Card>
            <CardContent className="flex flex-col gap-4 py-6">
              <div>
                <p className="mb-1 font-mono text-[10px] text-muted-foreground">Inter — Heading</p>
                <h1 className="font-sans text-4xl font-bold tracking-tight text-foreground">
                  Enterprise EPC Platform
                </h1>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] text-muted-foreground">Inter — Subheading</p>
                <h2 className="font-sans text-2xl font-semibold text-foreground">
                  GridMind Capital — Stage Gate Control
                </h2>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] text-muted-foreground">Inter — Body (leading-relaxed)</p>
                <p className="font-sans text-base leading-relaxed text-foreground">
                  GridMind Capital orchestrates the full lifecycle of renewable energy EPC projects — from intake and commercial close through engineering, procurement, construction, commissioning, and O&M handover.
                </p>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] text-muted-foreground">Inter — Caption</p>
                <p className="font-sans text-xs text-muted-foreground">
                  Last updated: 2026-07-20 · Workflow engine v3.4 · 14 active gates
                </p>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] text-muted-foreground">JetBrains Mono — Code</p>
                <code className="font-mono text-sm text-[#64ffda]">
                  {'GET /api/gates/G06/status → { state: "QUORUM_COMPLETE", signatories: 3 }'}
                </code>
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Buttons">
          <Card>
            <CardContent className="flex flex-col gap-6 py-6">
              {/* Variants */}
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">Variants</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">Default</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="gate">Convene Gate</Button>
                  <Button variant="success">Approve</Button>
                  <Button variant="warning">Flag</Button>
                  <Button variant="danger">Reject</Button>
                </div>
              </div>
              {/* Sizes */}
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">Sizes</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="xs">Extra Small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="xl">Extra Large</Button>
                </div>
              </div>
              {/* States */}
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">States</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled>Disabled</Button>
                  <Button loading>Loading...</Button>
                  <Button variant="gate" loading>Processing gate</Button>
                </div>
              </div>
              {/* Icons */}
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">With Icons</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg>
                    New Gate
                  </Button>
                  <Button variant="outline">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 8.5l-5 5-3-3"/><circle cx="8" cy="8" r="6.5"/></svg>
                    Approve
                  </Button>
                  <Button size="icon" variant="outline" aria-label="Settings">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* ── Badges ── */}
        <Section title="Badges">
          <Card>
            <CardContent className="flex flex-col gap-6 py-6">
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">Status</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status="draft" />
                  <StatusBadge status="submitted" />
                  <StatusBadge status="under-review" />
                  <StatusBadge status="approved" />
                  <StatusBadge status="rejected" />
                  <StatusBadge status="escalated" />
                </div>
              </div>
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">Priority</p>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority="critical" />
                  <PriorityBadge priority="high" />
                  <PriorityBadge priority="medium" />
                  <PriorityBadge priority="low" />
                  <PriorityBadge priority="info" />
                </div>
              </div>
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">Phase</p>
                <div className="flex flex-wrap gap-2">
                  <PhaseBadge phase="intake" />
                  <PhaseBadge phase="commercial" />
                  <PhaseBadge phase="engineering" />
                  <PhaseBadge phase="procurement" />
                  <PhaseBadge phase="construction" />
                  <PhaseBadge phase="commissioning" />
                  <PhaseBadge phase="om" />
                  <PhaseBadge phase="finance" />
                  <PhaseBadge phase="ai-analytics" />
                </div>
              </div>
              <div>
                <p className="mb-3 font-mono text-[10px] text-muted-foreground">Custom</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="gate">G06</Badge>
                  <Badge variant="outline">v2.4.1</Badge>
                  <Badge variant="default">Active</Badge>
                  <Badge variant="approved" dot>Live</Badge>
                  <Badge variant="rejected" dot>Blocked</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* ── Cards ── */}
        <Section title="Cards">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Default */}
            <Card>
              <CardHeader>
                <CardTitle>Project Overview</CardTitle>
                <CardDescription>Sirius 400MW Solar — EPC lifecycle summary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phase</span>
                    <PhaseBadge phase="construction" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gate</span>
                    <Badge variant="gate">G06</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status="under-review" />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">View Details</Button>
                <Button size="sm" variant="gate">Convene</Button>
              </CardFooter>
            </Card>

            {/* Accent */}
            <Card accent>
              <CardHeader>
                <CardTitle>Active Gate</CardTitle>
                <CardDescription>G06 — Construction Kick-off Review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Signatories</span>
                    <span className="font-mono text-[#64ffda]">3 / 5</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-1.5 w-3/5 rounded-full bg-[#64ffda]" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Waiting on IE countersignature and client approval.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="gate">Sign Off</Button>
              </CardFooter>
            </Card>

            {/* KPI */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio KPIs</CardTitle>
                <CardDescription>Across 5 active projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'IRR', value: '12.4%', color: '#22c55e' },
                    { label: 'NPV', value: '$840M', color: '#64ffda' },
                    { label: 'DSCR', value: '1.38×', color: '#3b82f6' },
                    { label: 'CPI', value: '0.97', color: '#f59e0b' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                      <p className="font-mono text-[10px] text-muted-foreground">{kpi.label}</p>
                      <p className="font-sans text-lg font-bold" style={{ color: kpi.color }}>
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── Inputs ── */}
        <Section title="Inputs">
          <Card>
            <CardContent className="grid gap-5 py-6 sm:grid-cols-2">
              <Input
                label="Project Name"
                placeholder="e.g. Sirius 400MW Solar"
                helperText="Used as the primary identifier across all modules."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
              />
              <Input
                label="Contract Value (SAR M)"
                placeholder="0.00"
                type="number"
                leadingIcon={
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v12M5 5h4.5a2 2 0 010 4H5v4h6"/></svg>
                }
                helperText="Enter the total contract value."
              />
              <Input
                label="Email Address"
                placeholder="pm@gridmind.io"
                type="email"
                required
                trailingIcon={
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 5.5l6 4 6-4"/></svg>
                }
              />
              <Input
                label="Gate Rationale"
                placeholder="Enter decision rationale"
                error="This field is required before gate submission."
                required
              />
            </CardContent>
          </Card>
        </Section>

        {/* ── Select ── */}
        <Section title="Select">
          <Card>
            <CardContent className="grid gap-5 py-6 sm:grid-cols-2">
              <Select
                label="Project Phase"
                placeholder="Select phase"
                value={selectVal}
                onValueChange={(v) => setSelectVal(v ?? '')}
                helperText="Determines which workflow applies."
                options={[
                  { value: 'intake', label: 'Intake', group: 'Early Stage' },
                  { value: 'commercial', label: 'Commercial', group: 'Early Stage' },
                  { value: 'engineering', label: 'Engineering', group: 'Execution' },
                  { value: 'procurement', label: 'Procurement', group: 'Execution' },
                  { value: 'construction', label: 'Construction', group: 'Execution' },
                  { value: 'commissioning', label: 'Commissioning', group: 'Handover' },
                  { value: 'om', label: 'O&M', group: 'Handover' },
                ]}
              />
              <Select
                label="Priority Level"
                placeholder="Select priority"
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />
              <Select
                label="Disabled Select"
                placeholder="Not available"
                disabled
                options={[{ value: 'x', label: 'Option X' }]}
                helperText="This field is locked during active review."
              />
              <Select
                label="With Error"
                placeholder="Select gate"
                error="A gate must be selected to proceed."
                options={[
                  { value: 'g4', label: 'G4 — Construction' },
                  { value: 'g6', label: 'G6 — Commissioning' },
                  { value: 'g9', label: 'G9 — PAC' },
                ]}
              />
            </CardContent>
          </Card>
        </Section>

        {/* ── Toast ── */}
        <Section title="Toast / Notifications">
          <Card>
            <CardContent className="py-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Click a button to trigger the corresponding notification toast.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => fireToast('default')}>Default</Button>
                <Button variant="success"   size="sm" onClick={() => fireToast('success')}>Success</Button>
                <Button variant="warning"   size="sm" onClick={() => fireToast('warning')}>Warning</Button>
                <Button variant="danger"    size="sm" onClick={() => fireToast('danger')}>Danger</Button>
                <Button variant="outline"   size="sm" onClick={() => fireToast('info')}>Info</Button>
                <Button variant="gate"      size="sm" onClick={() => fireToast('gate')}>Gate Event</Button>
              </div>
            </CardContent>
          </Card>
        </Section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <p className="font-mono text-xs text-muted-foreground">
            GridMind Capital — Design System v1.0
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Inter + JetBrains Mono · Tailwind v4 · base-ui
          </p>
        </div>
      </footer>
    </div>
  )
}
