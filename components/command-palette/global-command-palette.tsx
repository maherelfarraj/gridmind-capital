'use client'

import * as React from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import {
  Search, X, Folder, Shield, CheckSquare, FileText, Users,
  ArrowRight, Clock, Zap, ChevronRight, Keyboard,
  Navigation, Settings, Plus, LogIn, BarChart3, AlertCircle,
  FolderOpen, Gavel, ClipboardList, LayoutDashboard, User,
  Terminal, Star, Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────

type FilterTab = 'all' | 'projects' | 'gates' | 'tasks' | 'documents' | 'people'

interface ResultItem {
  id: string
  type: FilterTab
  title: string
  subtitle?: string
  meta?: string
  href: string
  badge?: { label: string; color: string }
  status?: { color: string }
  initials?: string
  avatarColor?: string
  kbd?: string
}

interface CommandItem {
  id: string
  category: string
  title: string
  description?: string
  kbd?: string
  href?: string
  action?: () => void
  icon: React.ComponentType<{ className?: string; size?: number }>
}

// ─── Mock index data ─────────────────────────────────────────

const MOCK_RESULTS: ResultItem[] = [
  // Projects
  { id: 'p1', type: 'projects', title: 'Sirius 400MW Solar', subtitle: 'NEOM, Saudi Arabia', meta: 'G4 — Construction', href: '/projects/sirius', badge: { label: 'Active', color: '#22c55e' }, status: { color: '#22c55e' } },
  { id: 'p2', type: 'projects', title: 'Vega BESS 2GWh', subtitle: 'Riyadh, Saudi Arabia', meta: 'G3 — Procurement', href: '/projects/vega', badge: { label: 'Active', color: '#22c55e' }, status: { color: '#22c55e' } },
  { id: 'p3', type: 'projects', title: 'Lyra Grid Upgrade', subtitle: 'Jeddah, Saudi Arabia', meta: 'G5 — QA/Inspection', href: '/projects/lyra', badge: { label: 'On Hold', color: '#f59e0b' }, status: { color: '#f59e0b' } },
  { id: 'p4', type: 'projects', title: 'Orion Wind Farm', subtitle: 'Tabuk, Saudi Arabia', meta: 'G2 — Engineering', href: '/projects/orion', badge: { label: 'Active', color: '#22c55e' }, status: { color: '#22c55e' } },
  { id: 'p5', type: 'projects', title: 'Helios Substation', subtitle: 'Dammam, Saudi Arabia', meta: 'G6 — Commissioning', href: '/projects/helios', badge: { label: 'Active', color: '#22c55e' }, status: { color: '#22c55e' } },
  // Gates
  { id: 'g1', type: 'gates', title: 'G4 — Construction Readiness', subtitle: 'Sirius 400MW', meta: 'In Progress', href: '/projects/sirius/g4', badge: { label: 'G4', color: '#6366f1' }, status: { color: '#6366f1' } },
  { id: 'g2', type: 'gates', title: 'G5 — QA Gate Review', subtitle: 'Lyra Grid Upgrade', meta: 'Pending Approval', href: '/projects/lyra/g5', badge: { label: 'G5', color: '#f59e0b' }, status: { color: '#f59e0b' } },
  { id: 'g3', type: 'gates', title: 'G6 — Commissioning Gate', subtitle: 'Helios Substation', meta: 'Complete', href: '/projects/helios/g6', badge: { label: 'G6', color: '#22c55e' }, status: { color: '#22c55e' } },
  { id: 'g4', type: 'gates', title: 'G3 — Contract Award', subtitle: 'Vega BESS', meta: 'Awaiting Chair', href: '/projects/vega/g3', badge: { label: 'G3', color: '#3b82f6' }, status: { color: '#3b82f6' } },
  // Tasks
  { id: 't1', type: 'tasks', title: 'Review pile foundation calculations', subtitle: 'Omar Al-Zaid', meta: 'Due 25 Jul', href: '/approvals', badge: { label: 'Critical', color: '#ef4444' } },
  { id: 't2', type: 'tasks', title: 'Approve HV cable routing Rev C', subtitle: 'Yuki Tanaka', meta: 'Due 28 Jul', href: '/approvals', badge: { label: 'High', color: '#f59e0b' } },
  { id: 't3', type: 'tasks', title: 'Submit monthly progress report IPA-03', subtitle: 'Aisha Al-Rashidi', meta: 'Due 31 Jul', href: '/approvals', badge: { label: 'Medium', color: '#6b7280' } },
  { id: 't4', type: 'tasks', title: 'Close NCR-042 — waterproofing defect', subtitle: 'James Morgan', meta: 'Overdue', href: '/approvals', badge: { label: 'Overdue', color: '#ef4444' } },
  // Documents
  { id: 'd1', type: 'documents', title: 'EPC Contract — Sirius 400MW', subtitle: 'Last modified 3 days ago', meta: 'Sirius 400MW', href: '/documents', badge: { label: 'Contract', color: '#6366f1' } },
  { id: 'd2', type: 'documents', title: 'G4 Gate Pack — Construction', subtitle: 'Last modified 1 day ago', meta: 'Vega BESS', href: '/documents', badge: { label: 'Gate Pack', color: '#3b82f6' } },
  { id: 'd3', type: 'documents', title: 'Risk Register Rev 4', subtitle: 'Last modified 5 days ago', meta: 'Orion Wind', href: '/documents', badge: { label: 'Risk', color: '#f59e0b' } },
  { id: 'd4', type: 'documents', title: 'Environmental Impact Assessment', subtitle: 'Last modified 12 days ago', meta: 'Lyra Grid', href: '/documents', badge: { label: 'Compliance', color: '#22c55e' } },
  // People
  { id: 'u1', type: 'people', title: 'James Morgan', subtitle: 'PMO Director', meta: 'Project Management', href: '/admin/users', initials: 'JM', avatarColor: '#6366f1' },
  { id: 'u2', type: 'people', title: 'Omar Al-Zaid', subtitle: 'Lead Civil Engineer', meta: 'Engineering', href: '/admin/users', initials: 'OA', avatarColor: '#3b82f6' },
  { id: 'u3', type: 'people', title: 'Aisha Al-Rashidi', subtitle: 'Finance Controller', meta: 'Finance', href: '/admin/users', initials: 'AA', avatarColor: '#f59e0b' },
  { id: 'u4', type: 'people', title: 'Yuki Tanaka', subtitle: 'Sr. Electrical Engineer', meta: 'Engineering', href: '/admin/users', initials: 'YT', avatarColor: '#22c55e' },
]

const COMMANDS: CommandItem[] = [
  // Navigation
  { id: 'nav-dashboard', category: 'Navigation', title: 'Go to Dashboard', icon: LayoutDashboard, href: '/', kbd: 'G D' },
  { id: 'nav-projects',  category: 'Navigation', title: 'Go to Projects', icon: FolderOpen, href: '/projects', kbd: 'G P' },
  { id: 'nav-approvals', category: 'Navigation', title: 'Go to Approvals', icon: Gavel, href: '/approvals', kbd: 'G A' },
  { id: 'nav-gates',     category: 'Navigation', title: 'Go to Stage Gates', icon: Shield, href: '/greos/stage-gates', kbd: 'G G' },
  { id: 'nav-risk',      category: 'Navigation', title: 'Go to Risk Register', icon: AlertCircle, href: '/risk/register' },
  { id: 'nav-reports',   category: 'Navigation', title: 'Go to Analytics', icon: BarChart3, href: '/executive/kpis' },
  // Actions
  { id: 'act-project',   category: 'Actions', title: 'Create New Project', icon: Plus, href: '/projects', kbd: 'N P' },
  { id: 'act-task',      category: 'Actions', title: 'Create New Task', icon: CheckSquare, href: '/approvals' },
  { id: 'act-doc',       category: 'Actions', title: 'Upload Document', icon: FileText, href: '/documents' },
  { id: 'act-report',    category: 'Actions', title: 'Export Report', icon: BarChart3, description: 'Generate PDF/Excel report', href: '/executive' },
  { id: 'act-invite',    category: 'Actions', title: 'Invite User', icon: User, href: '/admin/users' },
  // Settings
  { id: 'set-profile',   category: 'Settings', title: 'Open Profile Settings', icon: User, href: '/settings', kbd: 'G S' },
  { id: 'set-theme',     category: 'Settings', title: 'Toggle Dark Mode', icon: Settings, action: undefined },
  // Admin
  { id: 'adm-users',     category: 'Admin', title: 'Manage Users & Roles', icon: Users, href: '/admin/users' },
  { id: 'adm-doa',       category: 'Admin', title: 'View DOA Matrix', icon: ClipboardList, href: '/admin/doa-matrix' },
  { id: 'adm-audit',     category: 'Admin', title: 'View Audit Logs', icon: ClipboardList, href: '/admin/audit' },
]

const RECENT_SEARCHES = ['Sirius 400MW', 'G4 gate review', 'Aisha Al-Rashidi', 'EPC Contract']
const SUGGESTED_ACTIONS = [
  { label: 'Go to current gate', icon: Shield, href: '/greos/stage-gates' },
  { label: 'View my approvals', icon: Gavel, href: '/approvals' },
  { label: 'Create new task', icon: Plus, href: '/approvals' },
  { label: 'View risk register', icon: AlertCircle, href: '/risk/register' },
]

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'projects',  label: 'Projects' },
  { id: 'gates',     label: 'Gates' },
  { id: 'tasks',     label: 'Tasks' },
  { id: 'documents', label: 'Documents' },
  { id: 'people',    label: 'People' },
]

// ─── Result type icons ────────────────────────────────────────

function ResultIcon({ type, item }: { type: FilterTab; item: ResultItem }) {
  if (type === 'people' && item.initials) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: item.avatarColor ?? '#6366f1' }}>
        {item.initials}
      </div>
    )
  }
  const Icon = type === 'projects'  ? Folder
             : type === 'gates'     ? Shield
             : type === 'tasks'     ? CheckSquare
             : type === 'documents' ? FileText
             : Users
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
      <Icon size={15} className="text-muted-foreground" />
    </div>
  )
}

// ─── Keyboard shortcut cheat sheet ───────────────────────────

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['↑', '↓'], desc: 'Navigate results' },
    { keys: ['↵'], desc: 'Select / open' },
    { keys: ['Esc'], desc: 'Close palette' },
    { keys: ['⌘', 'K'], desc: 'Open palette' },
    { keys: ['⌘', '1–6'], desc: 'Jump to filter tab' },
    { keys: ['>'], desc: 'Enter command mode' },
    { keys: ['?'], desc: 'Show this help' },
  ]
  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-background p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Keyboard size={15} /> Keyboard Shortcuts
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div key={s.desc} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{s.desc}</span>
            <div className="flex items-center gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground min-w-[22px]">{k}</kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Palette ─────────────────────────────────────────────

export interface GlobalCommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function GlobalCommandPalette({ open, onClose }: GlobalCommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<FilterTab>('all')
  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isCommandMode = query.startsWith('>')
  const searchQuery = isCommandMode ? query.slice(1).trimStart() : query

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setQuery('')
      setFilter('all')
      setShowShortcuts(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // CMD+1-6 to jump filter tabs
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault()
        setFilter(FILTER_TABS[parseInt(e.key) - 1]?.id ?? 'all')
      }
      if (e.key === '?' && !isCommandMode) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isCommandMode])

  // Filtered results
  const results = React.useMemo(() => {
    const base = filter === 'all' ? MOCK_RESULTS : MOCK_RESULTS.filter((r) => r.type === filter)
    if (!searchQuery) return base
    const q = searchQuery.toLowerCase()
    return base.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.subtitle?.toLowerCase().includes(q) ||
      r.meta?.toLowerCase().includes(q)
    )
  }, [searchQuery, filter])

  // Filtered commands
  const commands = React.useMemo(() => {
    if (!isCommandMode) return []
    const q = searchQuery.toLowerCase()
    return q ? COMMANDS.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    ) : COMMANDS
  }, [isCommandMode, searchQuery])

  function navigate(href: string) {
    onClose()
    router.push(href)
  }

  const grouped = React.useMemo(() => {
    const cats = Array.from(new Set(commands.map((c) => c.category)))
    return cats.map((cat) => ({ cat, items: commands.filter((c) => c.category === cat) }))
  }, [commands])

  const isEmpty = !query && !isCommandMode

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(15,23,42,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        style={{ animation: 'palette-in 0.15s ease-out' }}
      >
        {showShortcuts && <ShortcutSheet onClose={() => setShowShortcuts(false)} />}

        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          {isCommandMode
            ? <Terminal size={16} className="shrink-0 text-gm-accent" />
            : <Search size={16} className="shrink-0 text-muted-foreground" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Escape') onClose()
            }}
            placeholder={isCommandMode ? 'Type a command...' : 'Search projects, gates, tasks, documents, people...'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none border-none ring-0"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowShortcuts((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={11} />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter tabs (hidden in command mode) */}
        {!isCommandMode && (
          <div className="flex items-center gap-0.5 border-b border-border px-4 py-1.5 overflow-x-auto scrollbar-none">
            {FILTER_TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {tab.label}
                <kbd className="hidden sm:inline-flex items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[9px] text-muted-foreground/70">
                  ⌘{i + 1}
                </kbd>
              </button>
            ))}
          </div>
        )}

        {/* Results / commands / empty state */}
        <div className="max-h-[420px] overflow-y-auto">
          {/* Empty state */}
          {isEmpty && (
            <div className="px-4 py-3">
              {/* Recent searches */}
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Clock size={10} /> Recent Searches
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {RECENT_SEARCHES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Hash size={10} />
                    {s}
                  </button>
                ))}
              </div>
              {/* Suggested actions */}
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Zap size={10} /> Suggested Actions
              </p>
              <div className="space-y-0.5">
                {SUGGESTED_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.href)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                      <a.icon size={13} className="text-muted-foreground" />
                    </div>
                    <span>{a.label}</span>
                    <ArrowRight size={12} className="ml-auto text-muted-foreground" />
                  </button>
                ))}
              </div>
              {/* Command mode hint */}
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Terminal size={10} />
                Type <kbd className="mx-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px]">&gt;</kbd> to enter command mode
              </p>
            </div>
          )}

          {/* Command mode */}
          {isCommandMode && (
            <div className="py-1">
              {grouped.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No commands match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
              {grouped.map(({ cat, items }) => (
                <div key={cat}>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{cat}</p>
                  {items.map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.href ? navigate(cmd.href) : cmd.action?.()}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors group"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 group-hover:bg-muted">
                        <cmd.icon size={13} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{cmd.title}</p>
                        {cmd.description && <p className="text-xs text-muted-foreground">{cmd.description}</p>}
                      </div>
                      {cmd.kbd && (
                        <div className="flex items-center gap-0.5">
                          {cmd.kbd.split(' ').map((k) => (
                            <kbd key={k} className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{k}</kbd>
                          ))}
                        </div>
                      )}
                      <ChevronRight size={12} className="shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Search results */}
          {!isEmpty && !isCommandMode && (
            <div className="py-1">
              {results.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-foreground mb-1">No matches found</p>
                  <p className="text-xs text-muted-foreground">
                    Try a different search term, or{' '}
                    <button className="text-primary underline underline-offset-2" onClick={() => setQuery('> create')}>
                      create new...
                    </button>
                  </p>
                </div>
              ) : (
                results.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors group"
                    style={{ animationDelay: `${i * 18}ms`, animation: 'result-in 0.12s ease-out both' }}
                  >
                    <ResultIcon type={item.type} item={item} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.subtitle && <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                        {item.meta && <span className="text-xs text-muted-foreground/60">· {item.meta}</span>}
                      </div>
                    </div>

                    {item.type === 'people' ? (
                      <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors">
                        Message
                      </span>
                    ) : item.badge ? (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                        style={{ color: item.badge.color, borderColor: `${item.badge.color}40`, background: `${item.badge.color}15` }}>
                        {item.badge.label}
                      </span>
                    ) : null}

                    {item.status && (
                      <span className="hidden sm:flex shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: item.status.color }} />
                    )}
                    <ChevronRight size={12} className="shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↵</kbd> select</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">Esc</kbd> close</span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">GridMind Capital</span>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes palette-in {
          from { opacity: 0; transform: scale(0.97) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes result-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
