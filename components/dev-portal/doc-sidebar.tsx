'use client'

import * as React from 'react'
import { Search, ChevronDown, ChevronRight, X, Menu, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocSection } from './types'
import { DOC_NAV, PROJECTS_ENDPOINTS, GATES_ENDPOINTS, TASKS_ENDPOINTS } from './types'

const ALL_ENDPOINTS = [
  ...PROJECTS_ENDPOINTS.map(e => ({ ...e, section: 'projects' })),
  ...GATES_ENDPOINTS.map(e => ({ ...e, section: 'gates' })),
  ...TASKS_ENDPOINTS.map(e => ({ ...e, section: 'tasks' })),
]

interface DocSidebarProps {
  activeSection: string
  onSelect: (id: string) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function NavItem({
  section,
  depth = 0,
  activeSection,
  onSelect,
}: {
  section: DocSection
  depth?: number
  activeSection: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = React.useState(true)
  const hasChildren = section.children && section.children.length > 0
  const isActive = activeSection === section.id

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setOpen(o => !o)
          else onSelect(section.id)
        }}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors text-left',
          depth === 0 ? 'font-semibold text-slate-300 hover:text-white' : 'font-normal',
          isActive && !hasChildren
            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
            : !hasChildren ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5' : 'hover:bg-white/5',
        )}
        style={{ paddingLeft: depth > 0 ? `${12 + depth * 12}px` : undefined }}
      >
        <span>{section.label}</span>
        {hasChildren && (
          open
            ? <ChevronDown size={13} className="text-slate-500 shrink-0" />
            : <ChevronRight size={13} className="text-slate-500 shrink-0" />
        )}
      </button>

      {hasChildren && open && (
        <div className="mt-0.5">
          {section.children!.map(child => (
            <NavItem
              key={child.id}
              section={child}
              depth={depth + 1}
              activeSection={activeSection}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DocSidebar({ activeSection, onSelect, mobileOpen, onMobileClose }: DocSidebarProps) {
  const [query, setQuery] = React.useState('')

  const filtered = query.trim()
    ? ALL_ENDPOINTS.filter(e =>
        e.path.toLowerCase().includes(query.toLowerCase()) ||
        e.summary.toLowerCase().includes(query.toLowerCase())
      )
    : null

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 h-screen z-40 lg:z-auto w-72 flex flex-col',
          'bg-[#0f1223] border-r border-white/8 transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <Code2 size={15} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">GridMind</div>
              <div className="text-[10px] text-slate-500 font-medium tracking-wide">API REFERENCE</div>
            </div>
          </div>
          <button onClick={onMobileClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-3 border-b border-white/8">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Search endpoints..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors"
            />
          </div>
        </div>

        {/* Nav / search results */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {filtered ? (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-600 px-2 py-1 uppercase tracking-wider">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </div>
              {filtered.map(e => (
                <button
                  key={e.id}
                  onClick={() => { onSelect(e.section); setQuery('') }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-left"
                >
                  <span className={cn('text-[10px] font-bold font-mono w-12 shrink-0 text-center rounded px-1 py-0.5',
                    e.method === 'GET'    ? 'bg-blue-500/20 text-blue-400' :
                    e.method === 'POST'   ? 'bg-emerald-500/20 text-emerald-400' :
                    e.method === 'PUT'    ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  )}>{e.method}</span>
                  <span className="text-xs text-slate-300 font-mono truncate">{e.path}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-slate-600 px-2 py-4 text-center">No endpoints found</p>
              )}
            </div>
          ) : (
            DOC_NAV.map(section => (
              <NavItem
                key={section.id}
                section={section}
                activeSection={activeSection}
                onSelect={onSelect}
              />
            ))
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/8">
          <div className="text-[10px] text-slate-600">v1.4.2 — Updated Jul 2026</div>
        </div>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden flex items-center gap-2 text-sm text-slate-400 hover:text-white"
    >
      <Menu size={18} />
    </button>
  )
}
