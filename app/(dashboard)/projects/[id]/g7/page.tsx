import { redirect } from 'next/navigation'

/**
 * Old /g7 route → new /gate/8 (Handover & O&M)
 * The old G7 page has real HandoverForm content that should migrate into the param route.
 * Redirect to single source of truth.
 */
export default async function G7RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/8`)
}

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'checklist' | 'assets' | 'om-transition'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function G7HandoverPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = React.useState<TabId>('checklist')

  const { data: g7Data } = useSWR(
    id ? `g7-data-${id}` : null,
    () => getG7Data(id!),
  )

  // G7 is a post-closeout page that sits beyond the G0–G6 gate model.
  // Show the stepper with the last recognised gate (G6) as current and
  // G0–G5 as completed, regardless of DB state, so all nodes are visible.
  const { data: project } = useSWR(
    id ? `project-${id}` : null,
    () => getProject(id!),
  )
  // Cap at G6 (index 6) since GATE_DEFINITIONS only defines G0–G6.
  const rawGate        = Math.min(project?.gate ?? 6, 6)
  const currentGateG7  = `G${rawGate}`
  const completedGatesG7 = Array.from({ length: Math.max(0, rawGate) }, (_, i) => `G${i}`)

  // Fall back to mock while loading / DB empty
  const milestones  = ((g7Data && g7Data.milestones.length > 0
    ? g7Data.milestones : null) ?? MOCK_MILESTONES) as unknown as typeof MOCK_MILESTONES
  const assets      = ((g7Data && g7Data.assets.length > 0
    ? g7Data.assets : null) ?? MOCK_ASSETS) as unknown as typeof MOCK_ASSETS
  const maintenance = ((g7Data && g7Data.maintenance.length > 0
    ? g7Data.maintenance : null) ?? MOCK_MAINTENANCE) as unknown as typeof MOCK_MAINTENANCE

  const complete   = milestones.filter((m) => m.status === 'complete').length
  const inProgress = milestones.filter((m) => m.status === 'in-progress').length

  const TABS: { id: TabId; label: string; count?: number; icon: React.ReactNode }[] = [
    { id: 'checklist',    label: 'Handover Checklist', count: milestones.length,  icon: <CheckSquare className="size-3.5" /> },
    { id: 'assets',       label: 'Asset Registry',     count: assets.length,      icon: <Layers      className="size-3.5" /> },
    { id: 'om-transition',label: 'O&M Transition',                                icon: <Settings    className="size-3.5" /> },
  ]

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/projects" className="hover:text-slate-700 transition-colors">Projects</Link>
          <ChevronRight className="size-3.5" />
          <Link href={`/projects/${id}`} className="hover:text-slate-700 transition-colors">{id}</Link>
          <ChevronRight className="size-3.5" />
          <span className="text-slate-700 font-medium">G7 Handover</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">G7: Handover &amp; O&amp;M Transition</h1>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded">G7</span>
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded">In Progress</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Handover checklist, asset registry, and O&amp;M team transition
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/stage-gates/${id}/gate/7`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm">
              <FileText className="size-4" /> Gate Submission Form
            </Link>
            <button type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm">
              <Package className="size-4" /> Export Handover Pack
            </button>
          </div>
        </div>

        {/* Gate stepper */}
        <PhaseGateStepper
          currentGate={currentGateG7}
          completedGates={completedGatesG7}
          projectId={id}
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Milestones Total',   value: String(milestones.length),   bg: 'bg-slate-100',   text: 'text-slate-700'   },
            { label: 'Complete',           value: String(complete),             bg: 'bg-emerald-100', text: 'text-emerald-700' },
            { label: 'In Progress',        value: String(inProgress),           bg: 'bg-amber-100',   text: 'text-amber-700'   },
            { label: 'Assets Registered',  value: String(assets.length),        bg: 'bg-blue-100',    text: 'text-blue-700'    },
          ].map(({ label, value, bg, text }) => (
            <div key={label} className={cn('rounded-xl px-4 py-4 border border-white/60 shadow-sm', bg)}>
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70 mb-0.5">{label}</p>
              <p className={cn('text-2xl font-black', text)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex min-w-max">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )}>
                {tab.icon}
                {tab.label}
                {tab.count != null && (
                  <span className={cn(
                    'text-[10px] rounded-full px-1.5 py-0.5 font-bold',
                    activeTab === tab.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'checklist'     && <HandoverChecklist milestones={milestones} />}
        {activeTab === 'assets'        && <AssetRegistry     assets={assets} />}
        {activeTab === 'om-transition' && (
          <OmTransition
            personnel={MOCK_OM_PERSONNEL}
            maintenance={maintenance}
            warranties={MOCK_WARRANTIES}
            sla={MOCK_SLA}
          />
        )}

      </div>
    </div>
  )
}
