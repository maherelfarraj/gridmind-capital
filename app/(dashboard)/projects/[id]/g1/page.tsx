import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Gavel, Users, ChevronRight } from 'lucide-react'
import { getProject } from '@/app/actions/projects'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'

export default async function G1Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) notFound()

  const currentGate = `G${project.gate}`
  const completedGates = Array.from({ length: Math.max(0, project.gate) }, (_, i) => `G${i}`)

  const sections = [
    {
      href: `/projects/${id}/g1/approval`,
      title: 'Gate Approval',
      desc: 'Deliverables checklist, multi-level approval workflow and chair decision for the G1 baseline sanction.',
      icon: Gavel,
    },
    {
      href: `/projects/${id}/g1/stakeholders`,
      title: 'Stakeholders',
      desc: 'Stakeholder register, influence / interest mapping and engagement plans for the development phase.',
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to project
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{project.code}</p>
            <h1 className="text-2xl font-bold text-foreground text-balance">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              G1 · Project Baseline Approved — Development phase
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground shrink-0">
            <span className="size-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} aria-hidden />
            {currentGate} · {project.gateName}
          </span>
        </div>
      </header>

      {/* Phase-gate stepper */}
      <PhaseGateStepper currentGate={currentGate} completedGates={completedGates} />

      {/* Tabbed sections — link to G1 sub-pages */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          G1 Workspace
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 hover:bg-muted/40"
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className="size-5 text-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed text-pretty">
                    {s.desc}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
