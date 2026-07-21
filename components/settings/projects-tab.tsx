'use client'

import * as React from 'react'
import { Folder, LogOut, Plus, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'Owner' | 'Admin' | 'Member' | 'Viewer'

interface ProjectAccess {
  id: string
  name: string
  capacity: string
  phase: string
  role: Role
  joined: string
  color: string
}

const PROJECTS: ProjectAccess[] = [
  { id: 'p1', name: 'Sirius 400MW Solar',         capacity: '400 MW',  phase: 'Construction', role: 'Owner',  joined: '2025-03-01', color: '#6366f1' },
  { id: 'p2', name: 'Vega BESS 200MWh',           capacity: '200 MWh', phase: 'Engineering',  role: 'Admin',  joined: '2025-06-15', color: '#22c55e' },
  { id: 'p3', name: 'Lyra 132kV Grid Connection', capacity: '132 kV',  phase: 'Procurement',  role: 'Member', joined: '2025-08-10', color: '#f59e0b' },
  { id: 'p4', name: 'Orion Offshore Wind',        capacity: '600 MW',  phase: 'Feasibility',  role: 'Viewer', joined: '2025-11-20', color: '#3b82f6' },
]

const ROLE_COLORS: Record<Role, string> = {
  Owner:  'text-indigo-500  bg-indigo-500/10 border-indigo-500/20',
  Admin:  'text-green-500   bg-green-500/10  border-green-500/20',
  Member: 'text-amber-500   bg-amber-500/10  border-amber-500/20',
  Viewer: 'text-slate-400   bg-slate-400/10  border-slate-400/20',
}

const ALL_PROJECTS = ['Helios Substation 220kV', 'Cygnus 50MW PV Farm', 'Altair Industrial Park']

export function ProjectsTab({ onSave }: { onSave: () => void }) {
  const [projects, setProjects] = React.useState(PROJECTS)
  const [requestProject, setRequestProject] = React.useState('')
  const [requestMessage, setRequestMessage] = React.useState('')
  const [showRequest, setShowRequest] = React.useState(false)

  function leave(id: string) {
    setProjects((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">My Projects</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} you have access to.</p>
          </div>
          <button onClick={() => setShowRequest(!showRequest)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors">
            <Plus className="size-3" /> Request Access
          </button>
        </div>

        {showRequest && (
          <div className="px-5 py-4 border-b border-border bg-muted/10 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Request Project Access</p>
            <div className="relative">
              <select value={requestProject} onChange={(e) => setRequestProject(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50 appearance-none">
                <option value="">Select a project…</option>
                {ALL_PROJECTS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Briefly explain why you need access…" rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none outline-none focus:ring-1 focus:ring-ring/50" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRequest(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors">
                Cancel
              </button>
              <button disabled={!requestProject} onClick={() => { setShowRequest(false); onSave() }}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-semibold">
                Send Request
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="size-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}18` }}>
                <Folder className="size-4" style={{ color: p.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.capacity} · {p.phase} · Joined {p.joined}</p>
              </div>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', ROLE_COLORS[p.role])}>
                {p.role}
              </span>
              {p.role !== 'Owner' && (
                <button onClick={() => leave(p.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <LogOut className="size-3" /> Leave
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
