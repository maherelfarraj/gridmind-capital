'use client'

import { useRouter } from 'next/navigation'

export function ProjectPicker({
  projects,
  selectedId,
  basePath,
}: {
  projects: { id: string; code: string; name: string }[]
  selectedId: string
  basePath: string
}) {
  const router = useRouter()
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Project</span>
      <select
        value={selectedId}
        onChange={(e) => router.push(`${basePath}?project=${e.target.value}`)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
