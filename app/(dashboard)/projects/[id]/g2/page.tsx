'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { getG2Data } from '@/app/actions/engineering'
import { getProject } from '@/app/actions/projects'
import {
  ChevronRight, Plus, MessageCircle, Send, FileUp, X, Zap, CheckCircle,
  Clock, FileText, Eye, AlertTriangle, Search, ChevronDown, Download,
} from 'lucide-react'
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'

// ─── Types ─────────────────────────────────────────────────────

interface UserProfile { name: string; initials: string; color: string }
interface DrawingRevision {
  revision: string; date: string; author: string; checker: string
  approver: string; description: string; status: string
}
interface EngineeringPackage {
  id: string; code: string; title: string; description: string
  discipline: string; phase: string; status: string; progress_percent: number
  drawing_count: number; rfi_count: number; review_count: number
  lead_engineer: UserProfile; reviewers: UserProfile[]
  created_at: string; updated_at: string
}
interface Drawing {
  id: string; number: string; title: string; discipline: string
  revision: string; status: string; date: string; package_id: string
  revisions: DrawingRevision[]
}
interface Transmittal {
  id: string; number: string; date: string; to: string; from: string
  subject: string; drawing_count: number; status: string
  purpose?: string; remarks?: string
  selected_drawings?: { number: string; title: string; revision: string; status: string }[]
}
interface RFIRecord {
  id: string; number: string; date: string; from_party: string; to_party: string
  subject: string; question: string; drawing_reference: string
  status: string; priority: string; due_date: string
  response: string | null; responded_by: string | null; responded_at: string | null
}

// ─── Constants ─────────────────────────────────────────────────

const DISCIPLINE_META: Record<string, { label: string; bg: string; text: string }> = {
  Civil:           { label: 'Civil',           bg: 'bg-amber-100  dark:bg-amber-900/30',  text: 'text-amber-700  dark:text-amber-400'  },
  Structural:      { label: 'Structural',      bg: 'bg-blue-100   dark:bg-blue-900/30',   text: 'text-blue-700   dark:text-blue-400'   },
  Mechanical:      { label: 'Mechanical',      bg: 'bg-red-100    dark:bg-red-900/30',    text: 'text-red-700    dark:text-red-400'    },
  Electrical:      { label: 'Electrical',      bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  Instrumentation: { label: 'Instrumentation', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  Piping:          { label: 'Piping',          bg: 'bg-cyan-100   dark:bg-cyan-900/30',   text: 'text-cyan-700   dark:text-cyan-400'   },
  Process:         { label: 'Process',         bg: 'bg-green-100  dark:bg-green-900/30',  text: 'text-green-700  dark:text-green-400'  },
  HVAC:            { label: 'HVAC',            bg: 'bg-sky-100    dark:bg-sky-900/30',    text: 'text-sky-700    dark:text-sky-400'    },
}

const PKG_STATUS_META: Record<string, { label: string; bg: string; text: string; fill: string }> = {
  'Draft':           { label: 'Draft',           bg: 'bg-slate-100  dark:bg-slate-800',  text: 'text-slate-700  dark:text-slate-300',  fill: '#94a3b8' },
  'Internal Review': { label: 'Internal Review', bg: 'bg-blue-100   dark:bg-blue-900/30', text: 'text-blue-700   dark:text-blue-400',   fill: '#3b82f6' },
  'Client Review':   { label: 'Client Review',   bg: 'bg-amber-100  dark:bg-amber-900/30',text: 'text-amber-700  dark:text-amber-400',  fill: '#f59e0b' },
  'Approved IFC':    { label: 'Approved IFC',    bg: 'bg-green-100  dark:bg-green-900/30',text: 'text-green-700  dark:text-green-400',  fill: '#22c55e' },
  'Approved AFC':    { label: 'Approved AFC',    bg: 'bg-emerald-100dark:bg-emerald-900/30',text:'text-emerald-700 dark:text-emerald-400',fill:'#10b981'},
  'Superseded':      { label: 'Superseded',      bg: 'bg-gray-100   dark:bg-gray-800',   text: 'text-gray-700   dark:text-gray-400',   fill: '#6b7280' },
}

const RFI_PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  Critical: { label: 'Critical', color: 'text-red-600',    bg: 'bg-red-100    dark:bg-red-900/30'    },
  High:     { label: 'High',     color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  Medium:   { label: 'Medium',   color: 'text-amber-600',  bg: 'bg-amber-100  dark:bg-amber-900/30'  },
  Low:      { label: 'Low',      color: 'text-green-600',  bg: 'bg-green-100  dark:bg-green-900/30'  },
}

const RFI_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  Open:      { label: 'Open',      color: 'text-blue-600',  bg: 'bg-blue-100   dark:bg-blue-900/30'  },
  Answered:  { label: 'Answered',  color: 'text-green-600', bg: 'bg-green-100  dark:bg-green-900/30' },
  Closed:    { label: 'Closed',    color: 'text-slate-600', bg: 'bg-slate-100  dark:bg-slate-800'    },
  Rejected:  { label: 'Rejected',  color: 'text-red-600',   bg: 'bg-red-100    dark:bg-red-900/30'   },
  Escalated: { label: 'Escalated', color: 'text-purple-600',bg: 'bg-purple-100 dark:bg-purple-900/30'},
}

const TRANSMITTAL_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  Draft:        { label: 'Draft',        bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-700 dark:text-slate-300'   },
  Sent:         { label: 'Sent',         bg: 'bg-blue-100  dark:bg-blue-900/30',  text: 'text-blue-700  dark:text-blue-400'   },
  Acknowledged: { label: 'Acknowledged', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400'  },
  Approved:     { label: 'Approved',     bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400'  },
  Rejected:     { label: 'Rejected',     bg: 'bg-red-100   dark:bg-red-900/30',   text: 'text-red-700   dark:text-red-400'   },
  Superseded:   { label: 'Superseded',   bg: 'bg-gray-100  dark:bg-gray-800',     text: 'text-gray-700  dark:text-gray-400'  },
}

// ─── Mock Data ──────────────────────────────────────────────────

const MOCK_PACKAGES: EngineeringPackage[] = [
  { id: 'p1', code: 'CIV-001', title: 'Civil Works Package',       description: 'Foundation design, earthworks, drainage',                  discipline: 'Civil',           phase: 'IFC', status: 'Approved IFC',    progress_percent: 100, drawing_count: 12, rfi_count: 0, review_count: 3, lead_engineer: { name: 'A. Kowalski',  initials: 'AK', color: '#3b82f6' }, reviewers: [{ name: 'J. Reyes', initials: 'JR', color: '#22c55e' }, { name: 'M. Holt', initials: 'MH', color: '#f59e0b' }], created_at: '2026-01-05', updated_at: '2026-01-15' },
  { id: 'p2', code: 'MEC-001', title: 'Mechanical Systems',        description: 'Turbine supply, cooling, auxiliary systems',               discipline: 'Mechanical',      phase: 'IFC', status: 'Client Review',   progress_percent:  75, drawing_count: 24, rfi_count: 5, review_count: 2, lead_engineer: { name: 'S. Müller',   initials: 'SM', color: '#a855f7' }, reviewers: [{ name: 'T. Chan',  initials: 'TC', color: '#64ffda' }], created_at: '2026-01-10', updated_at: '2026-02-01' },
  { id: 'p3', code: 'ELE-001', title: 'Electrical Systems',        description: 'HV switchyard, transformers, cabling',                    discipline: 'Electrical',      phase: 'IFC', status: 'Internal Review', progress_percent:  45, drawing_count: 18, rfi_count: 3, review_count: 1, lead_engineer: { name: 'P. Okafor',   initials: 'PO', color: '#f97316' }, reviewers: [{ name: 'K. Singh', initials: 'KS', color: '#06b6d4' }], created_at: '2026-01-15', updated_at: '2026-02-10' },
  { id: 'p4', code: 'INS-001', title: 'Instrumentation & Control', description: 'DCS, SCADA, field instruments',                           discipline: 'Instrumentation', phase: 'IFC', status: 'Draft',           progress_percent:  20, drawing_count:  8, rfi_count: 2, review_count: 0, lead_engineer: { name: 'N. Obi',      initials: 'NO', color: '#ec4899' }, reviewers: [], created_at: '2026-01-20', updated_at: '2026-02-15' },
  { id: 'p5', code: 'PIP-001', title: 'Piping Systems',            description: 'Process piping, utilities, supports',                     discipline: 'Piping',          phase: 'IFC', status: 'Client Review',   progress_percent:  60, drawing_count: 15, rfi_count: 4, review_count: 2, lead_engineer: { name: 'L. Ferreira', initials: 'LF', color: '#10b981' }, reviewers: [{ name: 'A. Kowalski', initials: 'AK', color: '#3b82f6' }], created_at: '2026-01-22', updated_at: '2026-02-08' },
  { id: 'p6', code: 'PRO-001', title: 'Process Engineering',       description: 'PFDs, P&IDs, equipment specs',                            discipline: 'Process',         phase: 'IFC', status: 'Approved IFC',    progress_percent: 100, drawing_count:  6, rfi_count: 0, review_count: 4, lead_engineer: { name: 'R. Vasquez',  initials: 'RV', color: '#f59e0b' }, reviewers: [{ name: 'S. Müller', initials: 'SM', color: '#a855f7' }, { name: 'P. Okafor', initials: 'PO', color: '#f97316' }], created_at: '2026-01-08', updated_at: '2026-01-25' },
]

const MOCK_DRAWINGS: Drawing[] = [
  { id: 'd1',  number: 'SOL-001-CIV-001-001', title: 'Foundation Layout Plan',    discipline: 'Civil',           revision: 'Rev C', status: 'Approved',      date: '2026-01-15', package_id: 'p1', revisions: [{ revision: 'Rev C', date: '2026-01-15', author: 'A. Kowalski', checker: 'J. Reyes', approver: 'M. Holt', description: 'Final IFC issue', status: 'Approved' },{ revision: 'Rev B', date: '2026-01-10', author: 'A. Kowalski', checker: 'J. Reyes', approver: '', description: 'Drainage updates', status: 'Superseded' }] },
  { id: 'd2',  number: 'SOL-001-CIV-001-002', title: 'Drainage Section A-A',      discipline: 'Civil',           revision: 'Rev B', status: 'Approved',      date: '2026-01-20', package_id: 'p1', revisions: [{ revision: 'Rev B', date: '2026-01-20', author: 'A. Kowalski', checker: 'J. Reyes', approver: 'M. Holt', description: 'Revised levels', status: 'Approved' }] },
  { id: 'd3',  number: 'SOL-001-MEC-001-001', title: 'Turbine Foundation',         discipline: 'Mechanical',      revision: 'Rev A', status: 'For Review',    date: '2026-02-01', package_id: 'p2', revisions: [{ revision: 'Rev A', date: '2026-02-01', author: 'S. Müller', checker: 'T. Chan', approver: '', description: 'Initial issue', status: 'For Review' }] },
  { id: 'd4',  number: 'SOL-001-MEC-001-002', title: 'Cooling System P&ID',        discipline: 'Mechanical',      revision: 'Rev 0', status: 'Draft',         date: '2026-02-05', package_id: 'p2', revisions: [{ revision: 'Rev 0', date: '2026-02-05', author: 'S. Müller', checker: '', approver: '', description: 'First draft', status: 'Draft' }] },
  { id: 'd5',  number: 'SOL-001-ELE-001-001', title: 'Single Line Diagram',        discipline: 'Electrical',      revision: 'Rev B', status: 'For Review',    date: '2026-02-10', package_id: 'p3', revisions: [{ revision: 'Rev B', date: '2026-02-10', author: 'P. Okafor', checker: 'K. Singh', approver: '', description: 'Updated cable sizing', status: 'For Review' }] },
  { id: 'd6',  number: 'SOL-001-ELE-001-002', title: 'Cable Routing Plan',         discipline: 'Electrical',      revision: 'Rev A', status: 'Draft',         date: '2026-02-12', package_id: 'p3', revisions: [{ revision: 'Rev A', date: '2026-02-12', author: 'P. Okafor', checker: '', approver: '', description: 'Initial routing', status: 'Draft' }] },
  { id: 'd7',  number: 'SOL-001-INS-001-001', title: 'Instrument List',            discipline: 'Instrumentation', revision: 'Rev 0', status: 'Draft',         date: '2026-02-15', package_id: 'p4', revisions: [{ revision: 'Rev 0', date: '2026-02-15', author: 'N. Obi', checker: '', approver: '', description: 'Preliminary list', status: 'Draft' }] },
  { id: 'd8',  number: 'SOL-001-PIP-001-001', title: 'Process Piping ISO',         discipline: 'Piping',          revision: 'Rev B', status: 'For Review',    date: '2026-02-08', package_id: 'p5', revisions: [{ revision: 'Rev B', date: '2026-02-08', author: 'L. Ferreira', checker: 'A. Kowalski', approver: '', description: 'Updated supports', status: 'For Review' }] },
  { id: 'd9',  number: 'SOL-001-PRO-001-001', title: 'PFD - Main Process',         discipline: 'Process',         revision: 'Rev C', status: 'Approved',      date: '2026-01-25', package_id: 'p6', revisions: [{ revision: 'Rev C', date: '2026-01-25', author: 'R. Vasquez', checker: 'S. Müller', approver: 'P. Okafor', description: 'IFC issue', status: 'Approved' }] },
  { id: 'd10', number: 'SOL-001-PRO-001-002', title: 'P&ID - Utilities',           discipline: 'Process',         revision: 'Rev B', status: 'Approved',      date: '2026-01-28', package_id: 'p6', revisions: [{ revision: 'Rev B', date: '2026-01-28', author: 'R. Vasquez', checker: 'S. Müller', approver: 'P. Okafor', description: 'Updated utilities', status: 'Approved' }] },
]

const MOCK_TRANSMITTALS: Transmittal[] = [
  {
    id: 't1', number: 'T-001', date: 'Jan 15, 2026', to: 'Client (EWEC)', from: 'GridMind Engineering',
    subject: 'G2 Civil IFC Package', drawing_count: 12, status: 'Approved',
    purpose: 'For Approval', remarks: 'All drawings IFC-stamped and ready for construction.',
    selected_drawings: [
      { number: 'CIV-001-001', title: 'Site General Arrangement',       revision: 'C', status: 'Approved IFC' },
      { number: 'CIV-001-002', title: 'Foundation Layout Plan',         revision: 'B', status: 'Approved IFC' },
      { number: 'CIV-001-003', title: 'Pile Schedule',                  revision: 'A', status: 'Approved IFC' },
    ],
  },
  {
    id: 't2', number: 'T-002', date: 'Feb 01, 2026', to: 'Client (EWEC)', from: 'GridMind Engineering',
    subject: 'G2 Mechanical Review', drawing_count: 24, status: 'Acknowledged',
    purpose: 'For Review & Comment', remarks: 'Awaiting client comments within 10 working days.',
    selected_drawings: [
      { number: 'MEC-001-001', title: 'Equipment Layout — Main Hall',   revision: 'B', status: 'Client Review' },
      { number: 'MEC-001-002', title: 'Turbine Arrangement',            revision: 'A', status: 'Client Review' },
    ],
  },
  {
    id: 't3', number: 'T-003', date: 'Feb 10, 2026', to: 'Client (EWEC)', from: 'GridMind Engineering',
    subject: 'G2 Electrical Draft', drawing_count: 18, status: 'Sent',
    purpose: 'For Information', remarks: 'Draft issue for client awareness. Not for construction.',
    selected_drawings: [
      { number: 'ELE-001-001', title: 'Single Line Diagram 33kV',       revision: 'A', status: 'Internal Review' },
      { number: 'ELE-001-002', title: 'Cable Schedule',                 revision: 'A', status: 'Draft' },
    ],
  },
  {
    id: 't4', number: 'T-004', date: 'Feb 15, 2026', to: 'Subcontractor', from: 'GridMind Engineering',
    subject: 'Instrumentation Specs', drawing_count: 8, status: 'Draft',
    purpose: 'For Tender', remarks: 'Tender package — confirm receipt.',
    selected_drawings: [
      { number: 'INS-001-001', title: 'Instrument Index',               revision: 'A', status: 'Draft' },
    ],
  },
  {
    id: 't5', number: 'T-005', date: 'Jan 25, 2026', to: 'Client (EWEC)', from: 'GridMind Engineering',
    subject: 'G2 Process IFC', drawing_count: 6, status: 'Approved',
    purpose: 'For Approval', remarks: 'Process & P&ID package — final IFC revision.',
    selected_drawings: [
      { number: 'PRO-001-001', title: 'Process Flow Diagram',           revision: 'C', status: 'Approved IFC' },
      { number: 'PRO-001-002', title: 'P&ID — Cooling Water System',   revision: 'B', status: 'Approved IFC' },
    ],
  },
]

const MOCK_RFIS: RFIRecord[] = [
  { id: 'r1', number: 'RFI-001', date: 'Feb 01, 2026', from_party: 'Mechanical',      to_party: 'Structural',  subject: 'Foundation load for turbine',   question: 'Please confirm the design foundation load for the turbine assembly including dynamic loads.', drawing_reference: 'CIV-001-001', status: 'Open',      priority: 'High',     due_date: 'Feb 08, 2026', response: null,                                                    responded_by: null,       responded_at: null },
  { id: 'r2', number: 'RFI-002', date: 'Feb 03, 2026', from_party: 'Electrical',      to_party: 'Mechanical',  subject: 'Cable penetration sealing',     question: 'What is the fire rating requirement for cable penetrations through firewall?',              drawing_reference: 'MEC-001-002', status: 'Answered',  priority: 'Medium',   due_date: 'Feb 10, 2026', response: 'EI 120 fire rating required per NFPA 101.',             responded_by: 'S. Müller', responded_at: 'Feb 07, 2026' },
  { id: 'r3', number: 'RFI-003', date: 'Feb 05, 2026', from_party: 'Client',          to_party: 'Process',     subject: 'Cooling water quality spec',    question: 'Please provide the cooling water quality specifications including pH, TDS, and biocide requirements.', drawing_reference: 'PRO-001-001', status: 'Open', priority: 'Critical', due_date: 'Feb 07, 2026', response: null,                                                    responded_by: null,       responded_at: null },
  { id: 'r4', number: 'RFI-004', date: 'Feb 08, 2026', from_party: 'Piping',          to_party: 'Civil',       subject: 'Pipe support foundation details', question: 'Confirm anchor bolt sizing and embedment depth for pipe support PL-001.',               drawing_reference: 'CIV-001-002', status: 'Closed',   priority: 'Low',      due_date: 'Feb 12, 2026', response: 'M24 bolts, 300mm embedment. See detail S-08.',          responded_by: 'A. Kowalski',responded_at: 'Feb 10, 2026'},
  { id: 'r5', number: 'RFI-005', date: 'Feb 10, 2026', from_party: 'Instrumentation', to_party: 'Electrical',  subject: 'Signal cable routing',          question: 'Confirm dedicated tray allocation for instrument signal cables to avoid EMI interference.',  drawing_reference: 'ELE-001-002', status: 'Open',      priority: 'Medium',   due_date: 'Feb 17, 2026', response: null,                                                    responded_by: null,       responded_at: null },
  { id: 'r6', number: 'RFI-006', date: 'Feb 12, 2026', from_party: 'Client',          to_party: 'Mechanical',  subject: 'Turbine delivery schedule',     question: 'Requesting updated turbine delivery schedule with milestone dates for client planning.',     drawing_reference: 'MEC-001-001', status: 'Escalated', priority: 'High',     due_date: 'Feb 14, 2026', response: null,                                                    responded_by: null,       responded_at: null },
  { id: 'r7', number: 'RFI-007', date: 'Feb 14, 2026', from_party: 'Structural',      to_party: 'Civil',       subject: 'Seismic design parameters',     question: 'Please confirm site-specific seismic zone classification and peak ground acceleration values.', drawing_reference: 'CIV-001-001', status: 'Answered',  priority: 'High',     due_date: 'Feb 18, 2026', response: 'Seismic Zone IIB, PGA = 0.15g per geotechnical report ref GT-001.', responded_by: 'A. Kowalski', responded_at: 'Feb 16, 2026'},
  { id: 'r8', number: 'RFI-008', date: 'Feb 15, 2026', from_party: 'HVAC',            to_party: 'Mechanical',  subject: 'Ventilation requirements',      question: 'Confirm ACH requirements for the turbine hall and auxiliary equipment rooms.',             drawing_reference: 'MEC-001-002', status: 'Open',      priority: 'Low',      due_date: 'Feb 22, 2026', response: null,                                                    responded_by: null,       responded_at: null },
]

const REVISION_TREND = [
  { month: 'Oct', count: 4 }, { month: 'Nov', count: 7 }, { month: 'Dec', count: 5 },
  { month: 'Jan', count: 12 }, { month: 'Feb', count: 9 },
]
const DISCIPLINE_PIE = Object.entries(
  MOCK_DRAWINGS.reduce<Record<string, number>>((a, d) => { a[d.discipline] = (a[d.discipline] ?? 0) + 1; return a }, {})
).map(([name, value]) => ({ name, value }))
const STATUS_BAR = [
  { name: 'Approved', count: 4 }, { name: 'For Review', count: 3 },
  { name: 'Draft', count: 3 }, { name: 'Superseded', count: 1 },
]
const PIE_COLORS = ['#64ffda', '#3b82f6', '#f59e0b', '#a855f7', '#22c55e', '#f97316', '#06b6d4']

// ─── Sub-components ────────────────────────────────────────────

function DisciplineBadge({ discipline }: { discipline: string }) {
  const m = DISCIPLINE_META[discipline] ?? { label: discipline, bg: 'bg-slate-100', text: 'text-slate-700' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold', m.bg, m.text)}>
      {m.label}
    </span>
  )
}

function StatusBadge({ status, meta }: { status: string; meta: Record<string, { label: string; bg: string; text: string }> }) {
  const m = meta[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-700' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold', m.bg, m.text)}>
      {m.label}
    </span>
  )
}

function Avatar({ user }: { user: UserProfile }) {
  return (
    <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-background text-white"
      style={{ backgroundColor: user.color }} title={user.name}>
      {user.initials}
    </div>
  )
}

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const color = pct === 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#64ffda'
  return (
    <div>
      <div className="h-1.5 w-full bg-muted rounded-full">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{pct}% complete</p>
    </div>
  )
}

// ─── Tab: Engineering Packages ─────────────────────────────────

function PackagesTab({ packages }: { packages: EngineeringPackage[] }) {
  const [search, setSearch]       = React.useState('')
  const [discipline, setDiscipline] = React.useState('All')
  const [status, setStatus]       = React.useState('All')
  const [addOpen, setAddOpen]     = React.useState(false)
  const [form, setForm]           = React.useState({ code: '', title: '', description: '', discipline: 'Civil', phase: 'IFC' })

  const disciplines = ['All', ...Object.keys(DISCIPLINE_META)]
  const statuses    = ['All', ...Object.keys(PKG_STATUS_META)]

  const filtered = packages.filter((p) => {
    const q = search.toLowerCase()
    if (q && !p.title.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false
    if (discipline !== 'All' && p.discipline !== discipline) return false
    if (status !== 'All' && p.status !== status) return false
    return true
  })

  return (
    <div>
      {/* Add Package Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Add Engineering Package</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            {[
              { label: 'Package Code *', key: 'code',        type: 'text' },
              { label: 'Title *',        key: 'title',       type: 'text' },
              { label: 'Description',    key: 'description', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <input type={type} value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
              </div>
            ))}
            {[
              { label: 'Discipline', key: 'discipline', opts: Object.keys(DISCIPLINE_META) },
              { label: 'Phase',      key: 'phase',      opts: ['Concept', 'Basic', 'Detailed', 'IFC', 'AFC'] },
            ].map(({ label, key, opts }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <select value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm focus:outline-none">
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAddOpen(false)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
              <button type="button" onClick={() => setAddOpen(false)}
                className="px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Package</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packages…"
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none" />
        </div>
        {[
          { label: 'Discipline', value: discipline, set: setDiscipline, opts: disciplines },
          { label: 'Status',     value: status,     set: setStatus,     opts: statuses    },
        ].map(({ label, value, set, opts }) => (
          <select key={label} value={value} onChange={(e) => set(e.target.value)}
            className="h-8 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none">
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        <button type="button" onClick={() => setAddOpen(true)}
          className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <Plus className="size-3.5" /> New Package
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {filtered.map((pkg) => {
          const sm = PKG_STATUS_META[pkg.status] ?? PKG_STATUS_META.Draft
          return (
            <div key={pkg.id}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
              {/* Card header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <DisciplineBadge discipline={pkg.discipline} />
                  <span className="text-[10px] font-mono text-muted-foreground">{pkg.code}</span>
                </div>
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold', sm.bg, sm.text)}>{sm.label}</span>
              </div>
              {/* Title + desc */}
              <p className="text-sm font-semibold text-foreground mt-3">{pkg.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>
              {/* Progress */}
              <div className="mt-3">
                <ProgressBar pct={pkg.progress_percent} status={pkg.status} />
              </div>
              {/* Stats row */}
              <div className="flex gap-4 mt-3">
                {[
                  { icon: FileText,      val: pkg.drawing_count, label: 'Drawings' },
                  { icon: MessageCircle, val: pkg.rfi_count,     label: 'RFIs'     },
                  { icon: Eye,           val: pkg.review_count,  label: 'Reviews'  },
                ].map(({ icon: Icon, val, label }) => (
                  <div key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="size-3" />
                    <span>{val}</span>
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-[10px] text-muted-foreground">Updated {pkg.updated_at}</span>
                <div className="flex">
                  {[pkg.lead_engineer, ...pkg.reviewers].slice(0, 3).map((u, i) => (
                    <div key={i} className={cn('border-2 border-background rounded-full', i > 0 && '-ml-2')}>
                      <Avatar user={u} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Drawing Register ──────────────────────────────────────

const DRAWING_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  Draft:      { label: 'Draft',      bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-700 dark:text-slate-300'  },
  'For Review':{ label: 'For Review',bg: 'bg-blue-100  dark:bg-blue-900/30',  text: 'text-blue-700  dark:text-blue-400'  },
  Approved:   { label: 'Approved',   bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  Superseded: { label: 'Superseded', bg: 'bg-gray-100  dark:bg-gray-800',     text: 'text-gray-700  dark:text-gray-400' },
  'As-Built': { label: 'As-Built',   bg: 'bg-purple-100dark:bg-purple-900/30',text: 'text-purple-700dark:text-purple-400'},
}

function DrawingRegisterTab({ drawings }: { drawings: Drawing[] }) {
  const [search, setSearch]       = React.useState('')
  const [discipline, setDiscipline] = React.useState('All')
  const [status, setStatus]       = React.useState('All')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const disciplines = ['All', ...Object.keys(DISCIPLINE_META)]
  const statuses    = ['All', ...Object.keys(DRAWING_STATUS_META)]

  const filtered = drawings.filter((d) => {
    const q = search.toLowerCase()
    if (q && !d.title.toLowerCase().includes(q) && !d.number.toLowerCase().includes(q)) return false
    if (discipline !== 'All' && d.discipline !== discipline) return false
    if (status !== 'All' && d.status !== status) return false
    return true
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drawings…"
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none" />
        </div>
        {[
          { label: 'Discipline', value: discipline, set: setDiscipline, opts: disciplines },
          { label: 'Status',     value: status,     set: setStatus,     opts: statuses    },
        ].map(({ label, value, set, opts }) => (
          <select key={label} value={value} onChange={(e) => set(e.target.value)}
            className="h-8 px-3 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none">
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Drawing No.', 'Title', 'Discipline', 'Revision', 'Status', 'Date', 'Package', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <React.Fragment key={d.id}>
                <tr className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-indigo-400">{d.number}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground max-w-[180px] truncate">{d.title}</td>
                  <td className="px-4 py-2.5"><DisciplineBadge discipline={d.discipline} /></td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded">{d.revision}</span>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={d.status} meta={DRAWING_STATUS_META} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{d.date}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.package_id}</td>
                  <td className="px-4 py-2.5">
                    <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expandedId === d.id && 'rotate-180')} />
                  </td>
                </tr>
                {expandedId === d.id && (
                  <tr className="border-b border-border">
                    <td colSpan={8} className="px-6 py-3 bg-muted/10">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Revision History</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] text-muted-foreground">
                            {['Revision', 'Date', 'Author', 'Checker', 'Approver', 'Description', 'Status'].map((h) => (
                              <th key={h} className="pr-4 py-1 text-left">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {d.revisions.map((rev) => (
                            <tr key={rev.revision} className="border-t border-border/40">
                              <td className="pr-4 py-1.5 font-mono text-indigo-400">{rev.revision}</td>
                              <td className="pr-4 py-1.5 text-muted-foreground whitespace-nowrap">{rev.date}</td>
                              <td className="pr-4 py-1.5 text-foreground">{rev.author}</td>
                              <td className="pr-4 py-1.5 text-muted-foreground">{rev.checker || '—'}</td>
                              <td className="pr-4 py-1.5 text-muted-foreground">{rev.approver || '—'}</td>
                              <td className="pr-4 py-1.5 text-muted-foreground max-w-[180px] truncate">{rev.description}</td>
                              <td className="py-1.5"><StatusBadge status={rev.status} meta={DRAWING_STATUS_META} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Transmittals ─────────────────────────────────────────

function TransmittalsTab({ transmittals }: { transmittals: Transmittal[] }) {
  const [addOpen,   setAddOpen]   = React.useState(false)
  const [coverT,    setCoverT]    = React.useState<Transmittal | null>(null)
  return (
    <div>
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">New Transmittal</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            {['To', 'Subject'].map((lbl) => (
              <div key={lbl}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{lbl}</label>
                <input type="text" className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm focus:outline-none" />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAddOpen(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground">Cancel</button>
              <button onClick={() => setAddOpen(false)} className="px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end p-4 border-b border-border">
        <button type="button" onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <Send className="size-3.5" /> New Transmittal
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Transmittal No.', 'Date', 'To', 'From', 'Subject', 'Drawings', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transmittals.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-muted/20 dark:hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-indigo-400">{t.number}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-3 text-sm text-foreground">{t.to}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{t.from}</td>
                <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{t.subject}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-center">{t.drawing_count}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} meta={TRANSMITTAL_STATUS_META} /></td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setCoverT(t)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 whitespace-nowrap">
                    Cover Sheet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cover Sheet slide-in panel */}
      {coverT && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setCoverT(null)} />
          <div className="w-full max-w-[540px] bg-background dark:bg-[#0a192f] border-l border-border shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background dark:bg-[#0a192f] z-10">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Transmittal Cover Sheet</p>
                <p className="text-base font-bold text-foreground">{coverT.number} — {coverT.subject}</p>
              </div>
              <button type="button" onClick={() => setCoverT(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Header grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Transmittal No.', value: coverT.number },
                  { label: 'Date',             value: coverT.date },
                  { label: 'From',             value: coverT.from },
                  { label: 'To',               value: coverT.to },
                  { label: 'Purpose',          value: coverT.purpose ?? '—' },
                  { label: 'Status',           value: coverT.status },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm text-foreground font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {/* Remarks */}
              {coverT.remarks && (
                <div className="rounded-lg border border-border bg-muted/20 dark:bg-muted/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Remarks</p>
                  <p className="text-sm text-foreground leading-relaxed">{coverT.remarks}</p>
                </div>
              )}

              {/* Drawing list */}
              {coverT.selected_drawings && coverT.selected_drawings.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Attached Drawings ({coverT.selected_drawings.length} of {coverT.drawing_count})
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                        {['Drawing No.','Title','Rev','Status'].map((h) => (
                          <th key={h} className="py-1.5 pr-3 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {coverT.selected_drawings.map((d) => (
                        <tr key={d.number} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 font-mono text-indigo-400">{d.number}</td>
                          <td className="py-2 pr-3 text-foreground">{d.title}</td>
                          <td className="py-2 pr-3 font-mono font-bold text-foreground">{d.revision}</td>
                          <td className="py-2"><StatusBadge status={d.status} meta={PKG_STATUS_META} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button type="button"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Download className="size-3.5" /> Download PDF
                </button>
                <button type="button"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-indigo-500/50 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                  <Send className="size-3.5" /> Resend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: RFIs ─────────────────────────────────────────────────

function RFIsTab({ rfis }: { rfis: RFIRecord[] }) {
  const [addOpen,    setAddOpen]    = React.useState(false)
  const [detailRfi,  setDetailRfi]  = React.useState<RFIRecord | null>(null)
  const [form, setForm] = React.useState({ from_party: 'Mechanical', to_party: 'Civil', subject: '', drawing_reference: '', question: '', priority: 'Medium' })

  return (
    <div className="relative">
      {/* Add RFI Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">New RFI</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            {[
              { label: 'From *',    key: 'from_party', type: 'text' },
              { label: 'To *',      key: 'to_party',   type: 'text' },
              { label: 'Subject *', key: 'subject',    type: 'text' },
              { label: 'Drawing Reference', key: 'drawing_reference', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <input type={type} value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm focus:outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm focus:outline-none">
                {['Low', 'Medium', 'High', 'Critical'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Question *</label>
              <textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} rows={4}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAddOpen(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground">Cancel</button>
              <button onClick={() => setAddOpen(false)} className="px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Submit RFI</button>
            </div>
          </div>
        </div>
      )}

      {/* RFI Detail slide-in panel */}
      {detailRfi && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setDetailRfi(null)} />
          <div className="w-full max-w-[500px] bg-background border-l border-border shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-400">{detailRfi.number}</span>
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded',
                  RFI_STATUS_META[detailRfi.status]?.bg, RFI_STATUS_META[detailRfi.status]?.color)}>
                  {detailRfi.status}
                </span>
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded',
                  RFI_PRIORITY_META[detailRfi.priority]?.bg, RFI_PRIORITY_META[detailRfi.priority]?.color)}>
                  {detailRfi.priority}
                </span>
              </div>
              <button type="button" onClick={() => setDetailRfi(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Subject</p>
                <p className="text-sm font-semibold text-foreground">{detailRfi.subject}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'From',     value: detailRfi.from_party        },
                  { label: 'To',       value: detailRfi.to_party          },
                  { label: 'Date',     value: detailRfi.date              },
                  { label: 'Due',      value: detailRfi.due_date          },
                  { label: 'Drawing',  value: detailRfi.drawing_reference },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-muted-foreground font-medium">{label}</p>
                    <p className="text-foreground font-mono">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Question</p>
                <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3">{detailRfi.question}</p>
              </div>
              {detailRfi.response && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Response</p>
                  <p className="text-sm text-foreground leading-relaxed bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">{detailRfi.response}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">By {detailRfi.responded_by} · {detailRfi.responded_at}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">Escalate</button>
                {!detailRfi.response && (
                  <button className="flex-1 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Respond</button>
                )}
                <button className="flex-1 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end p-4 border-b border-border">
        <button type="button" onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <MessageCircle className="size-3.5" /> New RFI
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['RFI No.', 'Date', 'From', 'To', 'Subject', 'Drawing', 'Priority', 'Status', 'Due Date', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rfis.map((rfi) => {
              const pm = RFI_PRIORITY_META[rfi.priority] ?? RFI_PRIORITY_META.Low
              const sm = RFI_STATUS_META[rfi.status]     ?? RFI_STATUS_META.Open
              return (
                <tr key={rfi.id} className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setDetailRfi(rfi)}>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-indigo-400">{rfi.number}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{rfi.date}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground">{rfi.from_party}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{rfi.to_party}</td>
                  <td className="px-4 py-2.5 text-sm text-foreground max-w-[180px] truncate">{rfi.subject}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{rfi.drawing_reference}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded', pm.bg, pm.color)}>{rfi.priority}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded', sm.bg, sm.color)}>{rfi.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{rfi.due_date}</td>
                  <td className="px-4 py-2.5">
                    {(rfi.status === 'Open' || rfi.status === 'Escalated') && (
                      <AlertTriangle className="size-3.5 text-amber-400" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Document Control ─────────────────────────────────────

const REVISION_MATRIX = [
  { doc: 'CIV-001-001', currentRev: 'Rev C', prevRev: 'Rev B', supersededDate: 'Jan 15, 2026', supersededBy: 'Rev C', status: 'Current'    },
  { doc: 'CIV-001-001', currentRev: 'Rev B', prevRev: 'Rev A', supersededDate: 'Jan 10, 2026', supersededBy: 'Rev C', status: 'Superseded' },
  { doc: 'MEC-001-001', currentRev: 'Rev A', prevRev: 'Rev 0', supersededDate: 'Feb 01, 2026', supersededBy: 'Rev A', status: 'Current'    },
  { doc: 'PRO-001-001', currentRev: 'Rev C', prevRev: 'Rev B', supersededDate: 'Jan 25, 2026', supersededBy: 'Rev C', status: 'Current'    },
  { doc: 'PRO-001-001', currentRev: 'Rev B', prevRev: 'Rev A', supersededDate: 'Jan 20, 2026', supersededBy: 'Rev C', status: 'Superseded' },
]

function DocumentControlTab() {
  return (
    <div className="space-y-6 p-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Documents', value: 10 },
          { label: 'Under Review',    value:  3 },
          { label: 'Approved',        value:  4 },
          { label: 'Superseded',      value:  3 },
          { label: 'Total Revisions', value: 14 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Revision Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={REVISION_TREND} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Discipline Breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={DISCIPLINE_PIE} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
                label={({ name, percent }) => `${(name ?? '').slice(0,3)} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                {DISCIPLINE_PIE.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Status Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={STATUS_BAR} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revision matrix */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Document Control Matrix</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                {['Document', 'Current Rev', 'Previous Rev', 'Superseded Date', 'Superseded By', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REVISION_MATRIX.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-2.5 font-mono text-xs text-indigo-400">{row.doc}</td>
                  <td className="px-4 py-2.5 font-mono text-xs bg-indigo-500/10 text-indigo-400 rounded">{row.currentRev}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.prevRev}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{row.supersededDate}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.supersededBy}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded',
                      row.status === 'Current' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Design Review & Approval ─────────────────────────────

type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'conditional'

interface ReviewItem {
  id: string
  discipline: string
  package_code: string
  title: string
  reviewer: string
  reviewer_role: string
  submitted_date: string
  due_date: string
  status: ReviewStatus
  comments: string
  action_items: string[]
}

const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; color: string }> = {
  pending:     { label: 'Pending',      color: '#6b7280' },
  in_review:   { label: 'In Review',    color: '#3b82f6' },
  approved:    { label: 'Approved',     color: '#22c55e' },
  rejected:    { label: 'Rejected',     color: '#ef4444' },
  conditional: { label: 'Conditional',  color: '#f59e0b' },
}

const MOCK_REVIEWS: ReviewItem[] = [
  { id: 'rv1', discipline: 'Civil',       package_code: 'EPC-CIV-001', title: 'Piling & Foundation Design',          reviewer: 'Omar Al-Zaid',    reviewer_role: 'Lead Civil Engineer',   submitted_date: '2026-04-10', due_date: '2026-04-25', status: 'approved',    comments: 'All pile load calculations verified. Geotech report incorporated.', action_items: [] },
  { id: 'rv2', discipline: 'Electrical',  package_code: 'EPC-ELE-002', title: 'HV Cable Routing & Sizing',           reviewer: 'Yuki Tanaka',     reviewer_role: 'Sr. Electrical Eng.',   submitted_date: '2026-04-12', due_date: '2026-04-28', status: 'conditional', comments: 'Cable cross-section sizing accepted. Routing through Zone C needs clash check.', action_items: ['Resolve clash at Junction Box JB-14', 'Resubmit single-line diagram Rev C'] },
  { id: 'rv3', discipline: 'Structural',  package_code: 'EPC-STR-003', title: 'Tracker Module Rail System',           reviewer: 'James Morgan',    reviewer_role: 'PMO Director',          submitted_date: '2026-04-15', due_date: '2026-05-02', status: 'in_review',   comments: 'Under structural peer review. Wind load analysis pending NEOM site data.', action_items: ['Provide NEOM wind load report', 'Confirm pile embedment depth'] },
  { id: 'rv4', discipline: 'Electrical',  package_code: 'EPC-ELE-004', title: 'Inverter Station LV Layout',           reviewer: 'Aisha Al-Rashidi',reviewer_role: 'Finance / Owner Rep',   submitted_date: '2026-04-18', due_date: '2026-05-05', status: 'in_review',   comments: 'Owner review ongoing. Earthing philosophy to be confirmed.', action_items: [] },
  { id: 'rv5', discipline: 'Civil',       package_code: 'EPC-CIV-005', title: 'Access Road Alignment & Pavement',    reviewer: 'Omar Al-Zaid',    reviewer_role: 'Lead Civil Engineer',   submitted_date: '2026-04-08', due_date: '2026-04-22', status: 'approved',    comments: 'Road alignment approved. Pavement design meets NEOM standards.', action_items: [] },
  { id: 'rv6', discipline: 'Mechanical',  package_code: 'EPC-MEC-006', title: 'O&M Building HVAC & MEP',             reviewer: 'Sarah Chen',      reviewer_role: 'Legal / Technical Rep', submitted_date: '2026-04-20', due_date: '2026-05-10', status: 'pending',     comments: 'Awaiting mechanical consultant markup.', action_items: ['Upload MEP consultant review comments'] },
]

function DesignReviewTab({ packages }: { packages: EngineeringPackage[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const total      = MOCK_REVIEWS.length
  const approved   = MOCK_REVIEWS.filter((r) => r.status === 'approved').length
  const inReview   = MOCK_REVIEWS.filter((r) => r.status === 'in_review' || r.status === 'conditional').length
  const pending    = MOCK_REVIEWS.filter((r) => r.status === 'pending').length
  const rejected   = MOCK_REVIEWS.filter((r) => r.status === 'rejected').length
  const pct        = Math.round((approved / total) * 100)

  const pieData = [
    { name: 'Approved',    value: approved, color: '#22c55e' },
    { name: 'In Review',   value: inReview, color: '#3b82f6' },
    { name: 'Pending',     value: pending,  color: '#6b7280' },
    { name: 'Rejected',    value: rejected, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  return (
    <div className="p-5 space-y-6">
      {/* KPI + pie row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-border bg-background p-5 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Design Review Approval Rate</p>
          <div className="text-4xl font-black text-foreground mb-3">{pct}<span className="text-2xl text-muted-foreground">%</span></div>
          <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden mb-1">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{approved} of {total} reviews approved</p>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Review Status Distribution</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="font-semibold text-foreground">{d.value}</span>
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Review items */}
      <div className="space-y-2">
        {MOCK_REVIEWS.map((r) => {
          const meta  = REVIEW_STATUS_META[r.status]
          const isOpen = expanded === r.id
          return (
            <div key={r.id} className={cn('rounded-xl border border-border overflow-hidden', isOpen && 'bg-muted/10')}>
              <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/10 transition-colors cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : r.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-xs text-muted-foreground">{r.package_code}</span>
                    <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{r.discipline}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                    <span>Reviewer: {r.reviewer}</span>
                    <span>Due: {r.due_date}</span>
                    {r.action_items.length > 0 && (
                      <span className="text-amber-500 font-medium">{r.action_items.length} action item{r.action_items.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
                  style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}>
                  {meta.label}
                </span>
                {isOpen ? <ChevronDown className="size-4 text-muted-foreground rotate-180 flex-shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />}
              </div>
              {isOpen && (
                <div className="px-5 pb-4 pt-0 border-t border-border/50 bg-muted/5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Reviewer Role</p>
                      <p className="text-sm font-medium text-foreground">{r.reviewer_role}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Submitted</p>
                      <p className="text-sm font-mono text-foreground">{r.submitted_date}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Review Comments</p>
                      <p className="text-sm text-foreground">{r.comments}</p>
                    </div>
                    {r.action_items.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-amber-500 mb-1">Open Action Items</p>
                        <ul className="space-y-1">
                          {r.action_items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="mt-1.5 size-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────

type TabId = 'packages' | 'drawings' | 'transmittals' | 'rfis' | 'doccontrol' | 'designreview'

export default function G2EngineeringPage() {
  const params = useParams<{ id: string }>()
  const projectId = params?.id ?? 'SOL-2026-001'

  const [tab, setTab] = React.useState<TabId>('packages')

  const { data: g2Data } = useSWR(
    projectId ? `g2-data-${projectId}` : null,
    () => getG2Data(projectId),
  )

  const { data: project } = useSWR(
    projectId ? `project-${projectId}` : null,
    () => getProject(projectId),
  )
  const currentGate    = `G${project?.gate ?? 2}`
  const completedGates = Array.from({ length: Math.max(0, project?.gate ?? 2) }, (_, i) => `G${i}`)

  // Use real data when available, fall back to mock while loading
  const packages     = g2Data?.packages     ?? MOCK_PACKAGES
  const drawings     = g2Data?.drawings     ?? MOCK_DRAWINGS
  const rfis         = g2Data?.rfis         ?? MOCK_RFIS
  const transmittals = MOCK_TRANSMITTALS

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'packages',    label: 'Engineering Packages', count: packages.length },
    { id: 'drawings',    label: 'Drawing Register',     count: drawings.length },
    { id: 'transmittals',label: 'Transmittals',         count: transmittals.length },
    { id: 'rfis',        label: 'RFIs',                 count: rfis.length },
    { id: 'doccontrol',  label: 'Document Control',     count: 0 },
    { id: 'designreview',label: 'Design Review',        count: 0 },
  ]

  const openRFIs     = rfis.filter((r) => r.status === 'Open' || r.status === 'Escalated').length
  const approvedPkgs = packages.filter((p) => p.status === 'Approved IFC' || p.status === 'Approved AFC').length
  const pendingPkgs  = packages.filter((p) => p.status === 'Internal Review' || p.status === 'Client Review').length

  const stats = [
    { label: 'Total Packages', value: packages.length, bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', icon: Zap },
    { label: 'Approved IFC',   value: approvedPkgs,   bg: 'bg-green-100  dark:bg-green-900/30',  text: 'text-green-700  dark:text-green-400',  icon: CheckCircle },
    { label: 'Pending Review', value: pendingPkgs,    bg: 'bg-amber-100  dark:bg-amber-900/30',  text: 'text-amber-700  dark:text-amber-400',  icon: Clock },
    { label: 'Open RFIs',      value: openRFIs,       bg: 'bg-red-100    dark:bg-red-900/30',    text: 'text-red-700    dark:text-red-400',    icon: MessageCircle },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/projects/${projectId}`} className="hover:text-foreground transition-colors">{projectId}</Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">G2 Engineering</span>
      </nav>

      {/* Title + badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">G2: Engineering IFC Release</h1>
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded">G2</span>
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-1 rounded">In Progress</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Issued For Construction drawings and specifications</p>
        </div>
        <Link href={`/stage-gates/${projectId}/gate/2`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
          <FileText className="size-4" /> Gate Submission Form
        </Link>
      </div>

      {/* Phase Gate Stepper */}
      <PhaseGateStepper currentGate={currentGate} completedGates={completedGates} projectId={projectId} />

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, bg, text, icon: Icon }) => (
          <div key={label} className={cn('rounded-xl p-4 flex items-center gap-3', bg)}>
            <Icon className={cn('size-5 shrink-0', text)} />
            <div>
              <p className={cn('text-2xl font-bold leading-tight', text)}>{value}</p>
              <p className={cn('text-[11px] font-medium', text)}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="size-4" /> New Package
        </button>
        <button type="button" className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-foreground text-sm hover:bg-muted/40 transition-colors">
          <MessageCircle className="size-4" /> New RFI
        </button>
        <button type="button" className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-foreground text-sm hover:bg-muted/40 transition-colors">
          <Send className="size-4" /> Transmittal
        </button>
        <button type="button" className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-foreground text-sm hover:bg-muted/40 transition-colors">
          <FileUp className="size-4" /> Import Drawings
        </button>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border" role="tablist">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                tab === id
                  ? 'border-indigo-500 text-indigo-500 dark:text-indigo-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  tab === id ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'bg-muted text-muted-foreground')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {tab === 'packages'     && <PackagesTab        packages={packages}        />}
        {tab === 'drawings'     && <DrawingRegisterTab  drawings={drawings}        />}
        {tab === 'transmittals' && <TransmittalsTab     transmittals={transmittals}/>}
        {tab === 'rfis'         && <RFIsTab             rfis={rfis}               />}
        {tab === 'doccontrol'   && <DocumentControlTab                             />}
        {tab === 'designreview' && <DesignReviewTab     packages={packages}        />}
      </div>
    </div>
  )
}
