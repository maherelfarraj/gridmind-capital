'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import {
  ChevronRight, Plus, AlertTriangle, FileText, Camera, HardHat,
  TrendingUp, FileCheck, ShieldCheck, BarChart3, MapPin, Users, X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'
import { cn } from '@/lib/utils'
import {
  MOCK_WORK_PACKAGES, MOCK_HSE_PLAN, MOCK_INCIDENTS, MOCK_PERMITS,
  SITE_READINESS_ITEMS, MOCK_PERSONNEL, MOCK_EQUIPMENT, MOCK_MATERIALS,
  MOCK_SUBCONTRACTORS, DISCIPLINE_PROGRESS,
} from '@/components/g4/data'
import { getG4Data } from '@/app/actions/construction'
import { WorkPackagesTab }  from '@/components/g4/work-packages-tab'
import { HSETab }           from '@/components/g4/hse-tab'
import { PermitsTab }       from '@/components/g4/permits-tab'
import { SiteReadinessTab } from '@/components/g4/site-readiness-tab'
import { ResourcesTab }     from '@/components/g4/resources-tab'
import { ProgressTab }      from '@/components/g4/progress-tab'

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-4 flex items-center gap-3 bg-white shadow-sm">
      <div className={cn('rounded-lg p-2.5', color)}>{icon}</div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 leading-none mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  )
}

export default function G4ConstructionPage() {
  const params = useParams()
  const projectId = (params?.id as string) ?? 'SOL-2026-001'
  const [activeTab, setActiveTab] = React.useState('work-packages')
  const [newWPOpen, setNewWPOpen] = React.useState(false)

  const { data: g4Data } = useSWR(
    projectId ? `g4-data-${projectId}` : null,
    () => getG4Data(projectId),
  )

  const workPackages = (g4Data && g4Data.workPackages.length > 0
    ? g4Data.workPackages : null) as unknown as typeof MOCK_WORK_PACKAGES ?? MOCK_WORK_PACKAGES
  const incidents    = (g4Data && g4Data.incidents.length > 0
    ? g4Data.incidents : null) as unknown as typeof MOCK_INCIDENTS ?? MOCK_INCIDENTS
  const permits      = (g4Data && g4Data.permits.length > 0
    ? g4Data.permits : null) as unknown as typeof MOCK_PERMITS ?? MOCK_PERMITS

  const TABS = [
    { id: 'work-packages', label: 'Work Packages',      count: workPackages.length,                                      icon: <HardHat    className="size-3.5" /> },
    { id: 'hse',           label: 'HSE Management',     count: incidents.filter((i) => i.status === 'Open').length,      icon: <ShieldCheck className="size-3.5" /> },
    { id: 'permits',       label: 'Permits & Licenses', count: permits.filter((p) => p.status !== 'Approved').length,    icon: <FileCheck  className="size-3.5" /> },
    { id: 'site',          label: 'Site Readiness',     count: null,                                                     icon: <MapPin     className="size-3.5" /> },
    { id: 'resources',     label: 'Resources',          count: null,                                                     icon: <Users      className="size-3.5" /> },
    { id: 'progress',      label: 'Progress',           count: null,                                                     icon: <BarChart3  className="size-3.5" /> },
  ]

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
            <Link href="/projects" className="hover:text-slate-800 transition-colors">Projects</Link>
            <ChevronRight className="size-3.5" />
            <Link href={`/projects/${projectId}`} className="hover:text-slate-800 transition-colors">{projectId}</Link>
            <ChevronRight className="size-3.5" />
            <span className="text-slate-700 font-medium">G4 Construction</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">G4: Construction Mobilization</h1>
                <Badge className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1">G4</Badge>
                <Badge className="bg-amber-100 text-amber-700">In Progress</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">Site mobilization, work packages, HSE readiness, and permit compliance</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/stage-gates/${projectId}/gate/4`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                <FileText className="size-4" /> Gate Submission Form
              </Link>
              <button type="button" onClick={() => setNewWPOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm">
                <Plus className="size-4" /> New Work Package
              </button>
              {[
                { label: 'HSE Report',      icon: <AlertTriangle className="size-4" /> },
                { label: 'Permit Tracker',  icon: <FileText      className="size-4" /> },
                { label: 'Site Inspection', icon: <Camera        className="size-4" /> },
              ].map(({ label, icon }) => (
                <button key={label} type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <PhaseGateStepper currentGate="G4" completedGates={['G0', 'G1', 'G2', 'G3']} projectId={projectId} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<HardHat    className="size-5 text-orange-600" />}  label="Work Packages"     value="24"      color="bg-orange-100" />
          <StatCard icon={<TrendingUp className="size-5 text-amber-600" />}   label="Mobilization %"   value="65%"     color="bg-amber-100"  />
          <StatCard icon={<FileCheck  className="size-5 text-green-600" />}   label="Permits Approved" value="8 of 12" color="bg-green-100"  />
          <StatCard icon={<ShieldCheck className="size-5 text-green-600" />}  label="HSE Incidents"    value="0"       color="bg-green-100"  />
        </div>

        {/* Tab bar */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex min-w-max">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                )}>
                {tab.icon}
                {tab.label}
                {tab.count != null && (
                  <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold',
                    activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'work-packages' && <WorkPackagesTab packages={workPackages} />}
        {activeTab === 'hse'           && <HSETab planItems={MOCK_HSE_PLAN} incidents={incidents} />}
        {activeTab === 'permits'       && <PermitsTab permits={permits} />}
        {activeTab === 'site'          && <SiteReadinessTab items={SITE_READINESS_ITEMS} />}
        {activeTab === 'resources'     && (
          <ResourcesTab
            personnel={MOCK_PERSONNEL}
            equipment={MOCK_EQUIPMENT}
            materials={MOCK_MATERIALS}
            subcontractors={MOCK_SUBCONTRACTORS}
          />
        )}
        {activeTab === 'progress' && <ProgressTab disciplines={DISCIPLINE_PROGRESS} />}
      </div>

      {/* New Work Package Modal */}
      {newWPOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[540px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">New Work Package</p>
              <button type="button" onClick={() => setNewWPOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
            <form className="px-6 py-5 grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); setNewWPOpen(false) }}>
              {[
                { label: 'WBS Code',    placeholder: 'e.g. 1.3.4',       colSpan: 1, type: 'text' },
                { label: 'WP Code',     placeholder: 'e.g. WP-009',       colSpan: 1, type: 'text' },
                { label: 'Title',       placeholder: 'Work package title', colSpan: 2, type: 'text' },
                { label: 'Description', placeholder: 'Scope description…', colSpan: 2, type: 'textarea' },
                { label: 'Start Date',  placeholder: '',                  colSpan: 1, type: 'date' },
                { label: 'End Date',    placeholder: '',                  colSpan: 1, type: 'date' },
                { label: 'Budget ($)',  placeholder: '0',                 colSpan: 1, type: 'number' },
                { label: 'Team Size',   placeholder: '0',                 colSpan: 1, type: 'number' },
              ].map(({ label, placeholder, colSpan, type }) => (
                <div key={label} className={cn('flex flex-col gap-1', colSpan === 2 ? 'col-span-2' : '')}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
                  {type === 'textarea'
                    ? <textarea placeholder={placeholder} rows={2} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 resize-none" />
                    : <input type={type} placeholder={placeholder} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                  }
                </div>
              ))}
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Discipline</label>
                  <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30">
                    {['Civil','Mechanical','Electrical','Instrumentation','Piping','Structural','Commissioning'].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Priority</label>
                  <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30">
                    {['Critical','High','Medium','Low'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setNewWPOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Create Work Package</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
