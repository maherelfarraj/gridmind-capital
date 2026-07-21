'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  ArrowLeft, Plus, Search, Filter, ChevronDown, ChevronUp,
  Download, Send, CheckCircle2, XCircle, Clock, AlertCircle,
  Building2, FileText, ShoppingCart, Star, TrendingUp,
  DollarSign, Package, Gavel, Award, BarChart3, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'

// ─── Types (matching G3ProcurementProps spec) ─────────────────

type RFQStatus   = 'draft' | 'published' | 'closed' | 'evaluated' | 'awarded' | 'cancelled'
type VendorStatus = 'approved' | 'pending' | 'suspended' | 'blacklisted'
type BidStatus    = 'submitted' | 'under_review' | 'shortlisted' | 'awarded' | 'rejected'
type POStatus     = 'draft' | 'issued' | 'acknowledged' | 'delivered' | 'closed' | 'disputed'
type ContractStatus = 'draft' | 'review' | 'executed' | 'active' | 'completed' | 'terminated'

interface RFQSpecification { section: string; requirement: string; mandatory: boolean }
interface EvaluationCriteria { criterion: string; weight: number; max_score: number }
interface VendorContact { name: string; title: string; email: string; phone: string }
interface QualificationItem { area: string; status: string; expiry: string | null; notes: string }
interface PerformanceRecord { project: string; year: number; on_time: boolean; quality_score: number; safety_score: number }
interface VendorDocument { type: string; name: string; expiry: string | null; status: string }
interface BidLineItem { code: string; description: string; qty: number; unit: string; unit_price: number; total: number }
interface Clarification { date: string; question: string; response: string | null }
interface PaymentTerm { milestone: string; percentage: number; due_days: number }
interface POLineItem { code: string; description: string; qty: number; unit: string; unit_price: number; total: number }
interface Milestone { name: string; due_date: string; completed: boolean }
interface ChangeOrder { co_number: string; description: string; value: number; status: string }

interface RFQ {
  id: string; code: string; title: string; description: string
  category: string; status: RFQStatus; value_min: number; value_max: number
  currency: string; bid_deadline: string; evaluation_period_days: number
  publish_date: string | null; invited_vendors: string[]; responded_vendors: string[]
  specifications: RFQSpecification[]; evaluation_criteria: EvaluationCriteria[]
  bids: Bid[]; created_at: string
}

interface Vendor {
  id: string; code: string; name: string; country: string
  categories: string[]; status: VendorStatus; qualification_score: number
  projects_completed: number; rating: number; contacts: VendorContact[]
  qualifications: QualificationItem[]; performance_history: PerformanceRecord[]
  documents: VendorDocument[]
}

interface Bid {
  id: string; rfq_id: string; vendor_id: string; vendor_name: string
  total_price: number; currency: string; technical_score: number
  commercial_score: number; delivery_score: number; past_performance_score: number
  total_score: number; rank: number; status: BidStatus; submission_date: string
  validity_days: number; line_items: BidLineItem[]; clarifications: Clarification[]
}

interface PurchaseOrder {
  id: string; code: string; vendor_id: string; vendor_name: string
  description: string; total_amount: number; currency: string; status: POStatus
  delivery_date: string; incoterms: string; payment_terms: PaymentTerm[]
  line_items: POLineItem[]; milestones: Milestone[]; changes: ChangeOrder[]
  created_at: string
}

interface Contract {
  id: string; code: string; vendor_id: string; vendor_name: string
  title: string; type: string; value: number; currency: string
  status: ContractStatus; start_date: string; end_date: string
  retention_pct: number; created_at: string
}

// ─── Mock Data ────────────────────────────────────────────────

const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1', code: 'VEN-001', name: 'Jinko Solar', country: 'China',
    categories: ['Solar PV', 'Modules'], status: 'approved',
    qualification_score: 94, projects_completed: 48, rating: 4.7,
    contacts: [{ name: 'Wang Lei', title: 'Sales Director', email: 'w.lei@jinkosolar.com', phone: '+86 21 6890 8888' }],
    qualifications: [{ area: 'ISO 9001', status: 'valid', expiry: '2027-06-30', notes: '' }],
    performance_history: [{ project: 'Riyadh Solar 300MW', year: 2024, on_time: true, quality_score: 92, safety_score: 95 }],
    documents: [{ type: 'Insurance', name: 'Public Liability', expiry: '2027-01-01', status: 'valid' }],
  },
  {
    id: 'v2', code: 'VEN-002', name: 'Huawei FusionSolar', country: 'China',
    categories: ['Inverters', 'SCADA'], status: 'approved',
    qualification_score: 91, projects_completed: 62, rating: 4.8,
    contacts: [{ name: 'Li Ming', title: 'Key Account Manager', email: 'l.ming@huawei.com', phone: '+86 755 2878 0808' }],
    qualifications: [{ area: 'ISO 14001', status: 'valid', expiry: '2026-12-31', notes: '' }],
    performance_history: [{ project: 'Neom Solar 500MW', year: 2024, on_time: true, quality_score: 95, safety_score: 97 }],
    documents: [{ type: 'Certificate', name: 'IEC 62109', expiry: null, status: 'valid' }],
  },
  {
    id: 'v3', code: 'VEN-003', name: 'ABB Saudi Arabia', country: 'Saudi Arabia',
    categories: ['Switchgear', 'Transformers', 'MV/HV'], status: 'approved',
    qualification_score: 88, projects_completed: 35, rating: 4.5,
    contacts: [{ name: 'Ahmed Al-Rashid', title: 'Business Development', email: 'a.rashid@abb.com', phone: '+966 11 488 8000' }],
    qualifications: [{ area: 'SASO Compliance', status: 'valid', expiry: '2026-09-30', notes: '' }],
    performance_history: [{ project: 'King Abdullah EPC', year: 2023, on_time: false, quality_score: 85, safety_score: 90 }],
    documents: [{ type: 'Financial', name: 'Bank Guarantee Facility', expiry: '2027-03-31', status: 'valid' }],
  },
  {
    id: 'v4', code: 'VEN-004', name: 'Prysmian Group', country: 'Italy',
    categories: ['Cables', 'DC Cables', 'AC Cables'], status: 'approved',
    qualification_score: 86, projects_completed: 29, rating: 4.4,
    contacts: [{ name: 'Marco Ferrari', title: 'Regional Director', email: 'm.ferrari@prysmian.com', phone: '+39 02 6449 1' }],
    qualifications: [{ area: 'IEC 60502', status: 'valid', expiry: '2028-01-01', notes: '' }],
    performance_history: [{ project: 'Qatar Substation Cable', year: 2024, on_time: true, quality_score: 88, safety_score: 91 }],
    documents: [{ type: 'Insurance', name: 'Product Liability', expiry: '2026-12-31', status: 'valid' }],
  },
  {
    id: 'v5', code: 'VEN-005', name: 'Al Futtaim Carillion', country: 'UAE',
    categories: ['Civil Works', 'Foundations', 'Roads'], status: 'approved',
    qualification_score: 82, projects_completed: 21, rating: 4.1,
    contacts: [{ name: 'James Morgan', title: 'Contracts Manager', email: 'j.morgan@alfuttaim.ae', phone: '+971 4 509 5000' }],
    qualifications: [{ area: 'ISO 45001', status: 'valid', expiry: '2027-05-31', notes: '' }],
    performance_history: [{ project: 'Dubai Solar Park', year: 2023, on_time: true, quality_score: 80, safety_score: 88 }],
    documents: [{ type: 'Bond', name: 'Performance Bond', expiry: '2027-06-30', status: 'valid' }],
  },
]

const MOCK_RFQS: RFQ[] = [
  {
    id: 'r1', code: 'RFQ-2026-001', title: 'Solar PV Modules Supply — 400MWp', description: 'Supply of bifacial monocrystalline PV modules for 400MWp plant.',
    category: 'Solar PV', status: 'awarded', value_min: 40_000_000, value_max: 50_000_000, currency: 'USD',
    bid_deadline: '2026-04-15', evaluation_period_days: 21, publish_date: '2026-03-01',
    invited_vendors: ['v1', 'v2'], responded_vendors: ['v1', 'v2'],
    specifications: [
      { section: 'Technical', requirement: 'Min 550Wp bifacial module', mandatory: true },
      { section: 'Technical', requirement: 'Efficiency ≥ 21.5%', mandatory: true },
      { section: 'Logistics', requirement: 'CIF Dammam port', mandatory: false },
    ],
    evaluation_criteria: [
      { criterion: 'Technical', weight: 40, max_score: 100 },
      { criterion: 'Commercial', weight: 35, max_score: 100 },
      { criterion: 'Delivery', weight: 15, max_score: 100 },
      { criterion: 'Past Performance', weight: 10, max_score: 100 },
    ],
    bids: [], created_at: '2026-03-01',
  },
  {
    id: 'r2', code: 'RFQ-2026-002', title: '1500V String Inverters — 400MW', description: 'Supply of utility-scale string inverters.',
    category: 'Inverters', status: 'evaluated', value_min: 10_000_000, value_max: 14_000_000, currency: 'USD',
    bid_deadline: '2026-04-20', evaluation_period_days: 14, publish_date: '2026-03-05',
    invited_vendors: ['v2'], responded_vendors: ['v2'],
    specifications: [
      { section: 'Technical', requirement: '1500V DC input', mandatory: true },
      { section: 'Technical', requirement: 'Peak efficiency ≥ 99%', mandatory: true },
    ],
    evaluation_criteria: [
      { criterion: 'Technical', weight: 45, max_score: 100 },
      { criterion: 'Commercial', weight: 30, max_score: 100 },
      { criterion: 'Delivery', weight: 15, max_score: 100 },
      { criterion: 'Past Performance', weight: 10, max_score: 100 },
    ],
    bids: [], created_at: '2026-03-05',
  },
  {
    id: 'r3', code: 'RFQ-2026-003', title: 'MV Switchgear 33kV', description: 'Supply and installation of 33kV gas-insulated switchgear.',
    category: 'Switchgear', status: 'published', value_min: 7_000_000, value_max: 10_000_000, currency: 'USD',
    bid_deadline: '2026-08-10', evaluation_period_days: 21, publish_date: '2026-07-01',
    invited_vendors: ['v3'], responded_vendors: [],
    specifications: [{ section: 'Technical', requirement: 'GIS 33kV IEC 62271-200', mandatory: true }],
    evaluation_criteria: [{ criterion: 'Technical', weight: 50, max_score: 100 }, { criterion: 'Commercial', weight: 50, max_score: 100 }],
    bids: [], created_at: '2026-07-01',
  },
  {
    id: 'r4', code: 'RFQ-2026-004', title: 'DC Cable Supply 1500V', description: '1500V DC cables 120mm² and 185mm² for string and combiner connections.',
    category: 'Cables', status: 'closed', value_min: 5_500_000, value_max: 7_000_000, currency: 'USD',
    bid_deadline: '2026-05-30', evaluation_period_days: 14, publish_date: '2026-05-01',
    invited_vendors: ['v4'], responded_vendors: ['v4'],
    specifications: [{ section: 'Technical', requirement: 'IEC 62930:2017 DC cable', mandatory: true }],
    evaluation_criteria: [{ criterion: 'Technical', weight: 40, max_score: 100 }, { criterion: 'Commercial', weight: 60, max_score: 100 }],
    bids: [], created_at: '2026-05-01',
  },
  {
    id: 'r5', code: 'RFQ-2026-005', title: 'Civil Works — Foundation & Roads', description: 'Earthworks, pile foundations for tracker systems, site roads, and fencing.',
    category: 'Civil', status: 'draft', value_min: 30_000_000, value_max: 45_000_000, currency: 'USD',
    bid_deadline: '2026-09-01', evaluation_period_days: 30, publish_date: null,
    invited_vendors: ['v5'], responded_vendors: [],
    specifications: [{ section: 'Technical', requirement: 'SASO civil standards compliance', mandatory: true }],
    evaluation_criteria: [{ criterion: 'Technical', weight: 35, max_score: 100 }, { criterion: 'Commercial', weight: 40, max_score: 100 }, { criterion: 'Past Performance', weight: 25, max_score: 100 }],
    bids: [], created_at: '2026-07-10',
  },
]

const MOCK_BIDS: Bid[] = [
  {
    id: 'b1', rfq_id: 'r1', vendor_id: 'v1', vendor_name: 'Jinko Solar',
    total_price: 44_800_000, currency: 'USD',
    technical_score: 92, commercial_score: 88, delivery_score: 90, past_performance_score: 95,
    total_score: 91.1, rank: 1, status: 'awarded', submission_date: '2026-04-14', validity_days: 90,
    line_items: [
      { code: 'MOD-001', description: '550Wp Bifacial Module JKM550M-72HL4-V', qty: 727_273, unit: 'pc', unit_price: 61.60, total: 44_800_000 },
    ],
    clarifications: [
      { date: '2026-04-05', question: 'Can delivery be split into 4 shipments?', response: 'Yes, phased delivery acceptable per schedule.' },
    ],
  },
  {
    id: 'b2', rfq_id: 'r1', vendor_id: 'v2', vendor_name: 'Huawei FusionSolar',
    total_price: 47_200_000, currency: 'USD',
    technical_score: 94, commercial_score: 82, delivery_score: 88, past_performance_score: 95,
    total_score: 89.4, rank: 2, status: 'rejected', submission_date: '2026-04-14', validity_days: 90,
    line_items: [
      { code: 'MOD-002', description: '560Wp Monocrystalline Module', qty: 714_285, unit: 'pc', unit_price: 66.08, total: 47_200_000 },
    ],
    clarifications: [],
  },
  {
    id: 'b3', rfq_id: 'r2', vendor_id: 'v2', vendor_name: 'Huawei FusionSolar',
    total_price: 11_600_000, currency: 'USD',
    technical_score: 96, commercial_score: 89, delivery_score: 92, past_performance_score: 97,
    total_score: 93.5, rank: 1, status: 'shortlisted', submission_date: '2026-04-19', validity_days: 90,
    line_items: [
      { code: 'INV-001', description: 'SUN2000-196KTL-H1 String Inverter', qty: 2040, unit: 'pc', unit_price: 5_686, total: 11_600_000 },
    ],
    clarifications: [
      { date: '2026-04-10', question: 'Confirm SCADA integration with ABB RMS', response: 'Full IEC 61850 support available.' },
    ],
  },
  {
    id: 'b4', rfq_id: 'r4', vendor_id: 'v4', vendor_name: 'Prysmian Group',
    total_price: 6_050_000, currency: 'USD',
    technical_score: 88, commercial_score: 91, delivery_score: 85, past_performance_score: 88,
    total_score: 89.0, rank: 1, status: 'submitted', submission_date: '2026-05-29', validity_days: 60,
    line_items: [
      { code: 'CAB-120', description: '1500V DC Cable 120mm² — 15,000m', qty: 15_000, unit: 'm', unit_price: 210, total: 3_150_000 },
      { code: 'CAB-185', description: '1500V DC Cable 185mm² — 10,000m', qty: 10_000, unit: 'm', unit_price: 290, total: 2_900_000 },
    ],
    clarifications: [],
  },
]

const MOCK_POS: PurchaseOrder[] = [
  {
    id: 'po1', code: 'PO-2026-001', vendor_id: 'v1', vendor_name: 'Jinko Solar',
    description: 'Solar PV Modules — 400MWp bifacial', total_amount: 44_800_000, currency: 'USD',
    status: 'acknowledged', delivery_date: '2026-09-30', incoterms: 'CIF Dammam',
    payment_terms: [
      { milestone: 'Down payment on PO issue', percentage: 30, due_days: 14 },
      { milestone: 'Factory acceptance test', percentage: 40, due_days: 7 },
      { milestone: 'Delivery to site', percentage: 30, due_days: 30 },
    ],
    line_items: [{ code: 'MOD-001', description: '550Wp Bifacial Module', qty: 727_273, unit: 'pc', unit_price: 61.60, total: 44_800_000 }],
    milestones: [
      { name: 'PO Acknowledgement', due_date: '2026-05-10', completed: true },
      { name: 'Factory Inspection', due_date: '2026-07-15', completed: false },
      { name: 'Shipment Q3', due_date: '2026-09-01', completed: false },
      { name: 'Site Delivery', due_date: '2026-09-30', completed: false },
    ],
    changes: [],
    created_at: '2026-05-01',
  },
  {
    id: 'po2', code: 'PO-2026-002', vendor_id: 'v2', vendor_name: 'Huawei FusionSolar',
    description: '1500V String Inverters 196kW', total_amount: 11_600_000, currency: 'USD',
    status: 'issued', delivery_date: '2026-08-31', incoterms: 'DDP Riyadh Yard',
    payment_terms: [
      { milestone: 'Advance on PO issue', percentage: 20, due_days: 14 },
      { milestone: 'Pre-shipment inspection', percentage: 60, due_days: 7 },
      { milestone: 'Warranty retention release', percentage: 20, due_days: 365 },
    ],
    line_items: [{ code: 'INV-001', description: 'SUN2000-196KTL-H1', qty: 2040, unit: 'pc', unit_price: 5_686, total: 11_600_000 }],
    milestones: [
      { name: 'PO Issue', due_date: '2026-05-15', completed: true },
      { name: 'Pre-ship Inspection', due_date: '2026-07-30', completed: false },
      { name: 'Site Delivery', due_date: '2026-08-31', completed: false },
    ],
    changes: [
      { co_number: 'CO-001', description: 'Revised delivery schedule +14 days', value: 0, status: 'approved' },
    ],
    created_at: '2026-05-15',
  },
  {
    id: 'po3', code: 'PO-2026-003', vendor_id: 'v4', vendor_name: 'Prysmian Group',
    description: '1500V DC Cables — 120mm² and 185mm²', total_amount: 6_050_000, currency: 'USD',
    status: 'delivered', delivery_date: '2026-07-15', incoterms: 'CIF Dammam',
    payment_terms: [{ milestone: 'On delivery & inspection', percentage: 100, due_days: 30 }],
    line_items: [
      { code: 'CAB-120', description: 'DC Cable 120mm²', qty: 15_000, unit: 'm', unit_price: 210, total: 3_150_000 },
      { code: 'CAB-185', description: 'DC Cable 185mm²', qty: 10_000, unit: 'm', unit_price: 290, total: 2_900_000 },
    ],
    milestones: [
      { name: 'PO Issue', due_date: '2026-04-20', completed: true },
      { name: 'Delivery Dammam', due_date: '2026-07-15', completed: true },
    ],
    changes: [],
    created_at: '2026-04-20',
  },
]

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1', code: 'CON-2026-001', vendor_id: 'v1', vendor_name: 'Jinko Solar',
    title: 'Supply Contract — PV Modules 400MWp', type: 'Supply',
    value: 44_800_000, currency: 'USD', status: 'executed',
    start_date: '2026-05-01', end_date: '2026-12-31', retention_pct: 5,
    created_at: '2026-04-30',
  },
  {
    id: 'c2', code: 'CON-2026-002', vendor_id: 'v2', vendor_name: 'Huawei FusionSolar',
    title: 'Supply Contract — Inverters 400MW', type: 'Supply',
    value: 11_600_000, currency: 'USD', status: 'active',
    start_date: '2026-05-15', end_date: '2027-05-14', retention_pct: 5,
    created_at: '2026-05-14',
  },
  {
    id: 'c3', code: 'CON-2026-003', vendor_id: 'v4', vendor_name: 'Prysmian Group',
    title: 'Supply Contract — DC Cables', type: 'Supply',
    value: 6_050_000, currency: 'USD', status: 'completed',
    start_date: '2026-04-20', end_date: '2026-09-30', retention_pct: 0,
    created_at: '2026-04-19',
  },
  {
    id: 'c4', code: 'CON-2026-004', vendor_id: 'v5', vendor_name: 'Al Futtaim Carillion',
    title: 'EPC Sub-Contract — Civil Works', type: 'EPC',
    value: 38_000_000, currency: 'USD', status: 'draft',
    start_date: '2026-10-01', end_date: '2028-03-31', retention_pct: 10,
    created_at: '2026-07-10',
  },
]

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const RFQ_STATUS_META: Record<RFQStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: '#94a3b8' },
  published: { label: 'Published', color: '#3b82f6' },
  closed:    { label: 'Closed',    color: '#f59e0b' },
  evaluated: { label: 'Evaluated', color: '#a855f7' },
  awarded:   { label: 'Awarded',   color: '#22c55e' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
}
const BID_STATUS_META: Record<BidStatus, { label: string; color: string }> = {
  submitted:    { label: 'Submitted',    color: '#3b82f6' },
  under_review: { label: 'Under Review', color: '#f59e0b' },
  shortlisted:  { label: 'Shortlisted',  color: '#a855f7' },
  awarded:      { label: 'Awarded',      color: '#22c55e' },
  rejected:     { label: 'Rejected',     color: '#ef4444' },
}
const PO_STATUS_META: Record<POStatus, { label: string; color: string }> = {
  draft:        { label: 'Draft',        color: '#94a3b8' },
  issued:       { label: 'Issued',       color: '#3b82f6' },
  acknowledged: { label: 'Acknowledged', color: '#a855f7' },
  delivered:    { label: 'Delivered',    color: '#22c55e' },
  closed:       { label: 'Closed',       color: '#10b981' },
  disputed:     { label: 'Disputed',     color: '#ef4444' },
}
const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; color: string }> = {
  draft:      { label: 'Draft',      color: '#94a3b8' },
  review:     { label: 'Review',     color: '#f59e0b' },
  executed:   { label: 'Executed',   color: '#3b82f6' },
  active:     { label: 'Active',     color: '#22c55e' },
  completed:  { label: 'Completed',  color: '#10b981' },
  terminated: { label: 'Terminated', color: '#ef4444' },
}

function StatusBadge({ status, meta }: { status: string; meta: Record<string, { label: string; color: string }> }) {
  const m = meta[status] ?? { label: status, color: '#94a3b8' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ color: m.color, background: `${m.color}18` }}>
      {m.label}
    </span>
  )
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-muted rounded-full">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-foreground">{score.toFixed(1)}</span>
    </div>
  )
}

// ─── Tab: RFQs ────────────────────────────────────────────────

function RFQsTab({ rfqs }: { rfqs: RFQ[] }) {
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<string>('all')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const filtered = rfqs.filter((r) => {
    const matchSearch = r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || r.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search RFQs…"
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm text-foreground focus:outline-none">
          <option value="all">All Status</option>
          {Object.keys(RFQ_STATUS_META).map((s) => <option key={s} value={s}>{RFQ_STATUS_META[s as RFQStatus].label}</option>)}
        </select>
        <Button size="sm"><Plus className="size-3.5" /> New RFQ</Button>
      </div>

      <div className="space-y-2">
        {filtered.map((rfq) => {
          const sm = RFQ_STATUS_META[rfq.status]
          const open = expanded === rfq.id
          return (
            <div key={rfq.id} className="border border-border rounded-xl bg-card overflow-hidden">
              <button type="button" className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(open ? null : rfq.id)}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-[#64ffda] shrink-0">{rfq.code}</span>
                  <span className="flex-1 text-sm font-semibold text-foreground">{rfq.title}</span>
                  <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{rfq.category}</span>
                  <span className="text-xs text-muted-foreground">{fmt(rfq.value_min)} – {fmt(rfq.value_max)}</span>
                  <span className="text-xs text-muted-foreground">Due {rfq.bid_deadline}</span>
                  <StatusBadge status={rfq.status} meta={RFQ_STATUS_META} />
                  <span className="text-xs text-muted-foreground">{rfq.responded_vendors.length}/{rfq.invited_vendors.length} responded</span>
                  {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                </div>
              </button>
              {open && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                  className="border-t border-border px-5 py-4 space-y-4 bg-muted/10">
                  <p className="text-sm text-muted-foreground">{rfq.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Specifications</p>
                      <div className="space-y-1.5">
                        {rfq.specifications.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className={cn('mt-0.5 shrink-0', s.mandatory ? 'text-red-400' : 'text-muted-foreground')}>
                              {s.mandatory ? '* ' : '  '}{s.section}:
                            </span>
                            <span className="text-foreground">{s.requirement}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Evaluation Criteria</p>
                      <div className="space-y-1.5">
                        {rfq.evaluation_criteria.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 text-foreground">{c.criterion}</span>
                            <span className="text-muted-foreground">{c.weight}%</span>
                            <div className="h-1.5 w-16 bg-muted rounded-full">
                              <div className="h-1.5 rounded-full bg-[#64ffda]" style={{ width: `${c.weight}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"><Send className="size-3.5" /> Publish</Button>
                    <Button size="sm" variant="outline"><Download className="size-3.5" /> Export</Button>
                  </div>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Vendors ────────────────────────────────────────────

function VendorsTab({ vendors }: { vendors: Vendor[] }) {
  const [search, setSearch]   = React.useState('')
  const [selected, setSelected] = React.useState<Vendor | null>(null)

  const filtered = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.country.toLowerCase().includes(search.toLowerCase()) ||
    v.categories.some((c) => c.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Vendor list */}
      <div className="flex-1 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors…"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <Button size="sm"><Plus className="size-3.5" /> Add Vendor</Button>
        </div>
        <div className="space-y-2">
          {filtered.map((v) => {
            const isSelected = selected?.id === v.id
            const statusColor = v.status === 'approved' ? '#22c55e' : v.status === 'pending' ? '#f59e0b' : '#ef4444'
            return (
              <button key={v.id} type="button"
                onClick={() => setSelected(isSelected ? null : v)}
                className={cn('w-full text-left rounded-xl border px-5 py-4 transition-all hover:bg-muted/20',
                  isSelected ? 'border-[#64ffda]/50 bg-[#64ffda]/5' : 'border-border bg-card')}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="size-9 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.country} · {v.categories.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('size-3', i < Math.floor(v.rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground')} />
                    ))}
                    <span className="text-xs text-foreground ml-1">{v.rating}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <ScoreBar score={v.qualification_score} />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Qual. Score</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: statusColor, background: `${statusColor}18` }}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Vendor detail panel */}
      {selected && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
          className="w-80 shrink-0 border border-border rounded-xl bg-card p-5 space-y-4 overflow-y-auto max-h-[600px]">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-foreground">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.code} · {selected.country}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Projects', value: selected.projects_completed },
              { label: 'Qual. Score', value: selected.qualification_score },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Contacts</p>
            {selected.contacts.map((c, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="text-muted-foreground">{c.title}</p>
                <p className="text-muted-foreground">{c.email}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Qualifications</p>
            {selected.qualifications.map((q, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                <span className="text-foreground">{q.area}</span>
                <span className="text-[#22c55e] font-semibold">{q.status}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Performance</p>
            {selected.performance_history.map((p, i) => (
              <div key={i} className="text-xs space-y-0.5 pb-2">
                <p className="font-semibold text-foreground">{p.project} ({p.year})</p>
                <div className="flex gap-3 text-muted-foreground">
                  <span>Quality: <span className="text-foreground">{p.quality_score}</span></span>
                  <span>Safety: <span className="text-foreground">{p.safety_score}</span></span>
                  <span className={p.on_time ? 'text-[#22c55e]' : 'text-red-400'}>{p.on_time ? 'On time' : 'Delayed'}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Tab: Bid Evaluation ──────────────────────────────────────

function BidEvaluationTab({ bids, rfqs }: { bids: Bid[]; rfqs: RFQ[] }) {
  const [rfqFilter, setRfqFilter] = React.useState<string>('all')

  const filtered = rfqFilter === 'all' ? bids : bids.filter((b) => b.rfq_id === rfqFilter)
  const sorted   = [...filtered].sort((a, b) => a.rank - b.rank)

  const radarData = sorted.map((b) => ({
    name: b.vendor_name.split(' ')[0],
    Technical: b.technical_score,
    Commercial: b.commercial_score,
    Delivery: b.delivery_score,
    Performance: b.past_performance_score,
  }))

  const SCORE_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7']

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={rfqFilter} onChange={(e) => setRfqFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm text-foreground focus:outline-none">
          <option value="all">All RFQs</option>
          {rfqs.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.title.slice(0, 30)}</option>)}
        </select>
        <Button size="sm" variant="outline"><Download className="size-3.5" /> Export Evaluation</Button>
      </div>

      {/* Score comparison chart */}
      {sorted.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Score Comparison by Criterion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={radarData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                {['Technical', 'Commercial', 'Delivery', 'Performance'].map((k, i) => (
                  <Bar key={k} dataKey={k} fill={SCORE_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bid register table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Rank','Vendor','RFQ','Total Price','Technical','Commercial','Delivery','Past Perf.','Total Score','Status',''].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((bid) => {
              const rfq = rfqs.find((r) => r.id === bid.rfq_id)
              return (
                <tr key={bid.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-3">
                    <div className={cn('size-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                      bid.rank === 1 ? 'bg-amber-400/20 text-amber-400' : 'bg-muted text-muted-foreground')}>
                      {bid.rank}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">{bid.vendor_name}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-[#64ffda]">{rfq?.code ?? bid.rfq_id}</td>
                  <td className="px-3 py-3 text-foreground font-semibold">{fmt(bid.total_price)}</td>
                  <td className="px-3 py-3"><ScoreBar score={bid.technical_score} /></td>
                  <td className="px-3 py-3"><ScoreBar score={bid.commercial_score} /></td>
                  <td className="px-3 py-3"><ScoreBar score={bid.delivery_score} /></td>
                  <td className="px-3 py-3"><ScoreBar score={bid.past_performance_score} /></td>
                  <td className="px-3 py-3">
                    <span className={cn('text-sm font-bold', bid.total_score >= 90 ? 'text-[#22c55e]' : bid.total_score >= 75 ? 'text-[#f59e0b]' : 'text-red-400')}>
                      {bid.total_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={bid.status} meta={BID_STATUS_META} /></td>
                  <td className="px-3 py-3">
                    {bid.clarifications.length > 0 && (
                      <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full">
                        {bid.clarifications.length} Q&A
                      </span>
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

// ─── Tab: Purchase Orders ─────────────────────────────────────

const PO_LIFECYCLE: POStatus[] = ['draft', 'issued', 'acknowledged', 'delivered', 'closed']

function POsTab({ pos }: { pos: PurchaseOrder[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm"><Plus className="size-3.5" /> New PO</Button>
      </div>
      {pos.map((po) => {
        const sm   = PO_STATUS_META[po.status]
        const open = expanded === po.id
        const lifeIdx = PO_LIFECYCLE.indexOf(po.status)
        const doneCount = po.milestones.filter((m) => m.completed).length

        return (
          <div key={po.id} className="border border-border rounded-xl bg-card overflow-hidden">
            <button type="button" className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
              onClick={() => setExpanded(open ? null : po.id)}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-[#64ffda] shrink-0">{po.code}</span>
                <span className="flex-1 text-sm font-semibold text-foreground">{po.description}</span>
                <span className="text-sm font-bold text-foreground">{fmt(po.total_amount)}</span>
                <span className="text-xs text-muted-foreground">{po.vendor_name}</span>
                <span className="text-xs text-muted-foreground">{po.incoterms}</span>
                <StatusBadge status={po.status} meta={PO_STATUS_META} />
                {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
              </div>
              {/* Lifecycle stepper */}
              <div className="flex items-center gap-1 mt-3">
                {PO_LIFECYCLE.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={cn('h-1.5 flex-1 rounded-full', i <= lifeIdx ? 'bg-[#64ffda]' : 'bg-muted')} />
                    {i < PO_LIFECYCLE.length - 1 && <div className="w-px h-2 bg-border" />}
                  </React.Fragment>
                ))}
              </div>
            </button>
            {open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }} className="border-t border-border px-5 py-4 space-y-4 bg-muted/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Milestones */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Milestones ({doneCount}/{po.milestones.length})
                    </p>
                    <div className="space-y-1.5">
                      {po.milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {m.completed
                            ? <CheckCircle2 className="size-3.5 text-[#22c55e] shrink-0" />
                            : <Clock className="size-3.5 text-muted-foreground shrink-0" />}
                          <span className={cn('flex-1', m.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>{m.name}</span>
                          <span className="text-muted-foreground shrink-0">{m.due_date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Payment terms */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Payment Terms</p>
                    <div className="space-y-1.5">
                      {po.payment_terms.map((t, i) => (
                        <div key={i} className="text-xs">
                          <p className="text-foreground">{t.milestone}</p>
                          <p className="text-muted-foreground">{t.percentage}% · Net {t.due_days} days</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Change orders */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Change Orders</p>
                    {po.changes.length === 0
                      ? <p className="text-xs text-muted-foreground">No change orders</p>
                      : po.changes.map((co, i) => (
                          <div key={i} className="text-xs space-y-0.5 pb-2">
                            <p className="font-mono text-[#64ffda]">{co.co_number}</p>
                            <p className="text-foreground">{co.description}</p>
                            <p className="text-muted-foreground">{co.value > 0 ? fmt(co.value) : 'No cost'} · {co.status}</p>
                          </div>
                        ))
                    }
                  </div>
                </div>
                {/* Line items */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Line Items</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {['Code','Description','Qty','Unit','Unit Price','Total'].map((h) => (
                          <th key={h} className="text-left px-2 py-1 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {po.line_items.map((li, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-2 py-1.5 font-mono text-[#64ffda]">{li.code}</td>
                          <td className="px-2 py-1.5 text-foreground">{li.description}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{li.qty.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{li.unit}</td>
                          <td className="px-2 py-1.5 text-foreground">${li.unit_price.toFixed(2)}</td>
                          <td className="px-2 py-1.5 font-semibold text-foreground">{fmt(li.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Contracts ───────────────────────────────────────────

function ContractsTab({ contracts }: { contracts: Contract[] }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm"><Plus className="size-3.5" /> New Contract</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Contract No.','Vendor','Title','Type','Value','Retention','Start','End','Status'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{c.code}</td>
                <td className="px-4 py-3 text-sm text-foreground">{c.vendor_name}</td>
                <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[200px] truncate">{c.title}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{c.type}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{fmt(c.value)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{c.retention_pct}%</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.start_date}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.end_date}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} meta={CONTRACT_STATUS_META} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Analytics ───────────────────────────────────────────

function AnalyticsTab({ rfqs, bids, pos, contracts }: {
  rfqs: RFQ[]; bids: Bid[]; pos: PurchaseOrder[]; contracts: Contract[]
}) {
  const rfqStatusData = Object.entries(
    rfqs.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name, value, color: RFQ_STATUS_META[name as RFQStatus]?.color ?? '#94a3b8' }))

  const categoryData = Object.entries(
    rfqs.reduce<Record<string, number>>((acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + (r.value_max / 1_000_000); return acc }, {})
  ).map(([name, value]) => ({ name, value: +value.toFixed(1) }))

  const trendData = [
    { month: 'Mar', rfqs: 3, pos: 0 },
    { month: 'Apr', rfqs: 2, pos: 2 },
    { month: 'May', rfqs: 1, pos: 2 },
    { month: 'Jun', rfqs: 0, pos: 1 },
    { month: 'Jul', rfqs: 1, pos: 0 },
  ]

  const totalContractValue = contracts.reduce((s, c) => s + c.value, 0)
  const totalPOValue        = pos.reduce((s, p) => s + p.total_amount, 0)
  const avgBidScore         = bids.length > 0 ? bids.reduce((s, b) => s + b.total_score, 0) / bids.length : 0

  const COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e']

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total RFQs',      value: rfqs.length,            icon: FileText,     color: '#64ffda' },
          { label: 'Total PO Value',  value: fmt(totalPOValue),      icon: ShoppingCart, color: '#22c55e' },
          { label: 'Contract Value',  value: fmt(totalContractValue),icon: Gavel,        color: '#a855f7' },
          { label: 'Avg Bid Score',   value: `${avgBidScore.toFixed(1)}`,icon: Award,    color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
              <span style={{ color }}><Icon className="size-4" /></span>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">RFQ Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={rfqStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {rfqStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Value by Category ($M)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryData} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`$${v}M`, 'Max Value']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Activity Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="rfqs" stroke="#64ffda" strokeWidth={2} dot={{ fill: '#64ffda', r: 3 }} name="RFQs" />
                <Line type="monotone" dataKey="pos"  stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="POs" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

type TabId = 'rfqs' | 'vendors' | 'bids' | 'pos' | 'contracts' | 'analytics'
const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'rfqs',      label: 'RFQs',         icon: FileText    },
  { id: 'vendors',   label: 'Vendors',      icon: Building2   },
  { id: 'bids',      label: 'Bid Evaluation',icon: Gavel      },
  { id: 'pos',       label: 'Purchase Orders',icon: ShoppingCart },
  { id: 'contracts', label: 'Contracts',    icon: Award       },
  { id: 'analytics', label: 'Analytics',    icon: BarChart3   },
]

export default function G3ProcurementPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = React.useState<TabId>('rfqs')

  const rfqs      = MOCK_RFQS
  const vendors   = MOCK_VENDORS
  const bids      = MOCK_BIDS
  const pos       = MOCK_POS
  const contracts = MOCK_CONTRACTS

  const totalCommitted = pos.reduce((s, p) => s + p.total_amount, 0)
  const openRFQs       = rfqs.filter((r) => r.status === 'published' || r.status === 'draft').length
  const approvedVendors = vendors.filter((v) => v.status === 'approved').length
  const activePOs      = pos.filter((p) => p.status !== 'closed').length

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-foreground transition-colors">{id}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">G3 Procurement</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href={`/projects/${id}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2">
                <ArrowLeft className="size-4" /> Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">G3 — Procurement</h1>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 uppercase tracking-widest">RFQ & Vendor</span>
          </div>
          <p className="text-sm text-muted-foreground ml-16">RFQ management · Vendor scorecards · Bid evaluation · PO lifecycle · Contracts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="size-3.5" /> Export</Button>
          <Button size="sm"><Plus className="size-4" /> Issue RFQ</Button>
        </div>
      </div>

      {/* Phase gate stepper */}
      <PhaseGateStepper currentGate="G3" completedGates={['G0', 'G1', 'G2']} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open RFQs',        value: openRFQs,                         color: '#3b82f6', icon: FileText    },
          { label: 'Approved Vendors', value: approvedVendors,                   color: '#22c55e', icon: Building2   },
          { label: 'Active POs',       value: activePOs,                         color: '#a855f7', icon: ShoppingCart },
          { label: 'Committed Value',  value: fmt(totalCommitted),              color: '#64ffda', icon: DollarSign   },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
              <span style={{ color }}><Icon className="size-4" /></span>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-0.5 border-b border-border overflow-x-auto">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} role="tab" aria-selected={tab === tid}
            onClick={() => setTab(tid)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
              tab === tid
                ? 'border-[#64ffda] text-[#64ffda]'
                : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {tab === 'rfqs'      && <RFQsTab      rfqs={rfqs} />}
        {tab === 'vendors'   && <VendorsTab   vendors={vendors} />}
        {tab === 'bids'      && <BidEvaluationTab bids={bids} rfqs={rfqs} />}
        {tab === 'pos'       && <POsTab       pos={pos} />}
        {tab === 'contracts' && <ContractsTab contracts={contracts} />}
        {tab === 'analytics' && <AnalyticsTab rfqs={rfqs} bids={bids} pos={pos} contracts={contracts} />}
      </motion.div>
    </div>
  )
}
