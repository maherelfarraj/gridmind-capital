'use client'

import * as React from 'react'
import Link from 'next/link'
import { Zap, Search, ChevronRight } from 'lucide-react'
import type { Department } from '@/lib/db/types'
import type { RoleWithCounts } from '@/lib/db/queries'

type RoleRow = RoleWithCounts & { assigned_person: string | null }

interface RolesTableProps {
  roles: RoleRow[]
  departments: Department[]
  projectSelected: boolean
}

export function RolesTable({ roles, departments, projectSelected }: RolesTableProps) {
  const [query, setQuery] = React.useState('')
  const [dept, setDept] = React.useState('all')
  const [bessOnly, setBessOnly] = React.useState(false)
  const [unassignedOnly, setUnassignedOnly] = React.useState(false)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return roles.filter((r) => {
      if (bessOnly && !r.is_bess_critical) return false
      if (unassignedOnly && r.assigned_person) return false
      if (dept !== 'all' && r.department_code !== dept) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.department_name.toLowerCase().includes(q)
      )
    })
  }, [roles, query, dept, bessOnly, unassignedOnly])

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles or codes…"
            aria-label="Search roles"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="sr-only" htmlFor="dept-filter">
            Filter by department
          </label>
          <select
            id="dept-filter"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={bessOnly}
              onChange={(e) => setBessOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            BESS-critical
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 text-muted-foreground data-[disabled=true]:opacity-40"
            data-disabled={!projectSelected}
            title={projectSelected ? undefined : 'Select a project to filter by assignment'}
          >
            <input
              type="checkbox"
              checked={unassignedOnly}
              disabled={!projectSelected}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Unassigned only
          </label>
          <span className="text-muted-foreground">
            {filtered.length} / {roles.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">Code</th>
              <th scope="col" className="px-4 py-3 font-medium">Role</th>
              <th scope="col" className="px-4 py-3 font-medium">Department</th>
              <th scope="col" className="px-4 py-3 font-medium">Assigned</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">A</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">R</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">C</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">I</th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No roles match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((role) => (
                <tr
                  key={role.id}
                  className="group border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/team/roles/${role.code}`}
                      className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-foreground hover:text-primary"
                    >
                      {role.code}
                      {role.is_bess_critical && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
                          title="BESS-critical role"
                        >
                          <Zap size={10} aria-hidden="true" />
                          BESS
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/team/roles/${role.code}`}
                      className="text-foreground hover:text-primary hover:underline"
                    >
                      {role.title}
                    </Link>
                    {!role.counts_toward_staffing && (
                      <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        support
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{role.department_name}</td>
                  <td className="px-4 py-3">
                    {role.assigned_person ? (
                      <span className="text-foreground">{role.assigned_person}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">
                        {projectSelected ? 'Unassigned' : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-foreground">{role.a_count}</td>
                  <td className="px-4 py-3 text-center font-medium text-foreground">{role.r_count}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{role.c_count}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{role.i_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/team/roles/${role.code}`}
                      aria-label={`View ${role.title} detail`}
                      className="inline-flex text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
