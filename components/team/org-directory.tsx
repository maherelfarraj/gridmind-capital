'use client'

import * as React from 'react'
import { Zap, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Department, Role } from '@/lib/db/types'

type RoleRow = Role & { department_name: string; department_code: string }

interface OrgDirectoryProps {
  departments: Department[]
  roles: RoleRow[]
}

export function OrgDirectory({ departments, roles }: OrgDirectoryProps) {
  const [query, setQuery] = React.useState('')
  const [bessOnly, setBessOnly] = React.useState(false)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return roles.filter((r) => {
      if (bessOnly && !r.is_bess_critical) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.mission ?? '').toLowerCase().includes(q) ||
        r.department_name.toLowerCase().includes(q)
      )
    })
  }, [roles, query, bessOnly])

  // Group filtered roles by department, preserving department order.
  const grouped = React.useMemo(() => {
    const byDept = new Map<string, RoleRow[]>()
    for (const r of filtered) {
      const arr = byDept.get(r.department_code) ?? []
      arr.push(r)
      byDept.set(r.department_code, arr)
    }
    return departments
      .map((d) => ({ dept: d, roles: byDept.get(d.code) ?? [] }))
      .filter((g) => g.roles.length > 0)
  }, [filtered, departments])

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles, codes, missions…"
            aria-label="Search roles"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={bessOnly}
              onChange={(e) => setBessOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            BESS-critical only
          </label>
          <span className="text-muted-foreground">
            {filtered.length} / {roles.length} roles
          </span>
        </div>
      </div>

      {/* Grouped departments */}
      {grouped.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No roles match your search.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ dept, roles: deptRoles }) => (
            <section key={dept.id} aria-label={dept.name} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{dept.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {dept.code}
                </span>
                <span className="text-xs text-muted-foreground">
                  {deptRoles.length} {deptRoles.length === 1 ? 'role' : 'roles'}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {deptRoles.map((role) => (
                  <RoleCard key={role.id} role={role} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleCard({ role }: { role: RoleRow }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{role.title}</h3>
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {role.code}
          </span>
        </div>
        {role.is_bess_critical && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[10px] font-medium text-primary"
            title="BESS-critical role"
          >
            <Zap size={11} aria-hidden="true" />
            BESS
          </span>
        )}
      </div>
      {role.mission && (
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{role.mission}</p>
      )}
      {!role.counts_toward_staffing && (
        <span className={cn('mt-auto w-fit rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground')}>
          Support role · excluded from staffing
        </span>
      )}
    </article>
  )
}
