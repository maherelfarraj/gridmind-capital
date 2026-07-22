'use client'

import { useRouter } from 'next/navigation'

export function ProjectPicker({
  projects,
  selectedId,
  basePath,
  allowNone = false,
  noneLabel = 'Tenant defaults',
}: {
  projects: { id: string; code: string; name: string }[]
  selectedId?: string
  basePath: string
  allowNone?: boolean
  noneLabel?: string
}) {
  const router = useRouter()

  function onChange(value: string) {
    if (!value) router.push(basePath)
    else router.push(`${basePath}?project=${value}`)
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Project</span>
      <select
        value={selectedId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {allowNone && <option value="">{noneLabel}</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
