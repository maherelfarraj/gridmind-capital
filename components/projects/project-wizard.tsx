'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, RotateCcw, Info, Wand2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { createProjectFull } from '@/app/actions/projects'

type Person = { id: string; full_name: string }
type RoleLite = { code: string; title: string }
type ApproverDefault = {
  gate_number: number
  gate_code: string
  gate_name: string
  primary_role: string | null
  secondary_role: string | null
}

const STEPS = ['Basics', 'Leadership', 'Gate Approvers'] as const

export function ProjectWizard({
  people,
  roles,
  approverDefaults,
}: {
  people: Person[]
  roles: RoleLite[]
  approverDefaults: ApproverDefault[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(0)

  // Step 1 — Basics
  const [name, setName] = useState('')
  const [technology, setTechnology] = useState('Solar PV + BESS')
  const [capacityMw, setCapacityMw] = useState('')
  const [bessMwh, setBessMwh] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('')
  const [targetCompletion, setTargetCompletion] = useState('')

  // Step 2 — Leadership
  const [pd, setPd] = useState('')
  const [pm, setPm] = useState('')

  // Step 3 — Gate approvers (editable copy of defaults)
  const [approvers, setApprovers] = useState(() =>
    approverDefaults.map((g) => ({
      gate_number: g.gate_number,
      primary_role: g.primary_role ?? '',
      secondary_role: g.secondary_role ?? '',
    })),
  )

  const capNum = Number(capacityMw)
  const samePerson = pd && pm && pd === pm
  const smallProject = capNum > 0 && capNum < 20

  // ── Validation per step ────────────────────────────────────
  const step1Valid = name.trim() !== '' && capNum > 0 && Number(bessMwh) >= 0 && bessMwh !== ''
  const step2Valid = pd !== '' && pm !== '' && (!samePerson || smallProject)

  function resetApprover(gateNumber: number) {
    const def = approverDefaults.find((d) => d.gate_number === gateNumber)
    setApprovers((prev) =>
      prev.map((a) =>
        a.gate_number === gateNumber
          ? {
              ...a,
              primary_role: def?.primary_role ?? '',
              secondary_role: def?.secondary_role ?? '',
            }
          : a,
      ),
    )
  }

  const generatedCode = useMemo(() => {
    const yr = new Date().getFullYear()
    const seq = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0')
    return `PRJ-${yr}-${seq}`
  }, [])

  function handleCreate() {
    startTransition(async () => {
      const res = await createProjectFull({
        name: name.trim(),
        codeHint: generatedCode,
        technology,
        capacity_mw: capNum,
        bess_mwh: Number(bessMwh) || 0,
        location: location.trim(),
        country: country.trim(),
        target_completion: targetCompletion || null,
        pdPersonId: pd,
        pmPersonId: pm,
        approvers: approvers.map((a) => ({
          gate_number: a.gate_number,
          primary_role: a.primary_role || null,
          secondary_role: a.secondary_role || null,
        })),
      })
      if ('error' in res) {
        toast({ title: res.error, variant: 'danger' })
      } else {
        toast({ title: 'Project created — G1 sign-offs sent', variant: 'success' })
        router.push('/dashboard')
      }
    })
  }

  const roleOptions = roles.map((r) => r.code)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground text-balance">New Project</h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Three steps: basics, leadership, and gate approvers. On create we open G1 for review and
          notify its sign-off roles.
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step
          const active = i === step
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                      ? 'bg-primary/15 text-primary ring-2 ring-primary/40'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="ml-1 h-px flex-1 bg-border" />}
            </li>
          )
        })}
      </ol>

      <div className="rounded-lg border border-border bg-card p-5">
        {/* Step 1 — Basics */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="col-span-full flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Project name <span className="text-destructive">*</span>
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Al Dhafra Solar + Storage"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Code (auto)</span>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono text-muted-foreground">
                <Wand2 className="size-3.5" />
                {generatedCode}
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Technology</span>
              <select
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['Solar PV + BESS', 'Solar PV', 'BESS', 'Wind', 'Wind + BESS', 'Hybrid'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Capacity (MW) <span className="text-destructive">*</span>
              </span>
              <input
                type="number"
                min={0}
                value={capacityMw}
                onChange={(e) => setCapacityMw(e.target.value)}
                placeholder="e.g. 400"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                BESS energy (MWh) <span className="text-destructive">*</span>
              </span>
              <input
                type="number"
                min={0}
                value={bessMwh}
                onChange={(e) => setBessMwh(e.target.value)}
                placeholder="e.g. 800"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Abu Dhabi"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Country</span>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. UAE"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Target completion</span>
              <input
                type="date"
                value={targetCompletion}
                onChange={(e) => setTargetCompletion(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        )}

        {/* Step 2 — Leadership */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Project Director and Project Manager are required. They&apos;re assigned to the
                project team immediately so G1 sign-offs can route to them.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Project Director (PD) <span className="text-destructive">*</span>
              </span>
              <select
                value={pd}
                onChange={(e) => setPd(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Project Manager (PM) <span className="text-destructive">*</span>
              </span>
              <select
                value={pm}
                onChange={(e) => setPm(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>

            {samePerson && smallProject && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Same person as PD and PM — allowed under 20 MW, but consider separating these roles
                as the project scales.
              </p>
            )}
            {samePerson && !smallProject && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                PD and PM must be different people for a project of this size (≥ 20 MW).
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Gate approvers */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Pre-filled from tenant defaults. Subcontractors are invited at G5–G6 scoped to their
                packages; client viewers gain read access at G7+.
              </p>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Gate</th>
                    <th className="px-3 py-2 text-left font-medium">Primary</th>
                    <th className="px-3 py-2 text-left font-medium">Secondary</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {approvers.map((a) => {
                    const def = approverDefaults.find((d) => d.gate_number === a.gate_number)
                    return (
                      <tr key={a.gate_number}>
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {def?.gate_code}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">{def?.gate_name}</span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={a.primary_role}
                            onChange={(e) =>
                              setApprovers((prev) =>
                                prev.map((x) =>
                                  x.gate_number === a.gate_number
                                    ? { ...x, primary_role: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">—</option>
                            {roleOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={a.secondary_role}
                            onChange={(e) =>
                              setApprovers((prev) =>
                                prev.map((x) =>
                                  x.gate_number === a.gate_number
                                    ? { ...x, secondary_role: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— none —</option>
                            {roleOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => resetApprover(a.gate_number)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Reset to default"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-40 hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid)}
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
          >
            Next
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !step1Valid || !step2Valid}
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Create project
          </button>
        )}
      </div>
    </div>
  )
}
