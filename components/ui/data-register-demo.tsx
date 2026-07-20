'use client'

import * as React from 'react'
import { Plus, Download, Eye } from 'lucide-react'
import { DataRegister, type ColumnDef } from '@/components/ui/data-register'
import { Badge, StatusBadge, PriorityBadge, type StatusVariant, type PriorityVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/* ── Mock data ─────────────────────────────────────────────── */

type ProjectRow = {
  id:       string
  code:     string
  name:     string
  client:   string
  mw:       number
  budget:   number
  status:   StatusVariant
  priority: PriorityVariant
  gate:     number
  location: string
  pm:       string
}

const MOCK_PROJECTS: ProjectRow[] = [
  { id: 'P001', code: 'GMC-001', name: 'Sirius 400MW Solar Farm',      client: 'SolarTech Holdings', mw: 400, budget: 480_000_000, status: 'approved',      priority: 'critical', gate: 4, location: 'Western Cape, ZA',     pm: 'Aisha Nkrumah'   },
  { id: 'P002', code: 'GMC-002', name: 'Vega 200MW Wind Array',        client: 'WindCo Energy',      mw: 200, budget: 210_000_000, status: 'under-review',   priority: 'high',     gate: 2, location: 'Northern Cape, ZA',  pm: 'James Okafor'    },
  { id: 'P003', code: 'GMC-003', name: 'Lyra BESS 150MWh Storage',     client: 'GridStorage SA',     mw: 150, budget: 160_000_000, status: 'submitted',      priority: 'high',     gate: 1, location: 'Gauteng, ZA',        pm: 'Priya Sharma'    },
  { id: 'P004', code: 'GMC-004', name: 'Orion 80MW Offshore Wind',     client: 'Blue Ocean Power',   mw: 80,  budget:  95_000_000, status: 'draft',          priority: 'medium',   gate: 0, location: 'Eastern Cape, ZA',   pm: 'Carlos Mendes'   },
  { id: 'P005', code: 'GMC-005', name: 'Helios HV Substation',         client: 'Eskom Subsidiary',   mw: 0,   budget:  42_000_000, status: 'approved',       priority: 'medium',   gate: 6, location: 'KwaZulu-Natal, ZA',  pm: 'Fatima Al-Rashid'},
  { id: 'P006', code: 'GMC-006', name: 'Atlas 300MW Hybrid Park',      client: 'Atlas Renewables',   mw: 300, budget: 350_000_000, status: 'escalated',      priority: 'critical', gate: 3, location: 'Limpopo, ZA',        pm: 'Thabo Molefe'    },
  { id: 'P007', code: 'GMC-007', name: 'Nova 60MW Rooftop Solar',      client: 'Nova City Dev',      mw: 60,  budget:  58_000_000, status: 'under-review',   priority: 'low',      gate: 1, location: 'Cape Town, ZA',      pm: 'Ingrid van Dijk' },
  { id: 'P008', code: 'GMC-008', name: 'Phoenix 500MW Mega Solar',     client: 'Phoenix Energy',     mw: 500, budget: 590_000_000, status: 'submitted',      priority: 'critical', gate: 2, location: 'Northern Cape, ZA',  pm: 'Kwame Asante'    },
  { id: 'P009', code: 'GMC-009', name: 'Polaris 120MW Wind Repowering',client: 'OldWind Ltd',        mw: 120, budget:  98_000_000, status: 'rejected',       priority: 'medium',   gate: 1, location: 'Free State, ZA',     pm: 'Sonia Petrov'    },
  { id: 'P010', code: 'GMC-010', name: 'Ceres 250MW Agri-Solar',       client: 'FarmPower Co',       mw: 250, budget: 275_000_000, status: 'approved',       priority: 'high',     gate: 5, location: 'Mpumalanga, ZA',     pm: 'David Chen'      },
  { id: 'P011', code: 'GMC-011', name: 'Titan 700MW Floating Solar',   client: 'Aqua Solar Inc',     mw: 700, budget: 820_000_000, status: 'draft',          priority: 'high',     gate: 0, location: 'Western Cape, ZA',   pm: 'Aisha Nkrumah'   },
  { id: 'P012', code: 'GMC-012', name: 'Aura 45MW C&I Rooftop',        client: 'Industrial Parks SA',mw: 45,  budget:  41_000_000, status: 'approved',       priority: 'low',      gate: 7, location: 'Gauteng, ZA',        pm: 'Carlos Mendes'   },
]

const fmt = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', notation: 'compact', maximumFractionDigits: 1 })

/* ── Column definitions ────────────────────────────────────── */

const COLUMNS: ColumnDef<ProjectRow>[] = [
  {
    key: 'code',
    header: 'Code',
    width: '96px',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
    ),
  },
  {
    key: 'name',
    header: 'Project Name',
    sortable: true,
    render: (row) => (
      <span className="font-medium text-foreground">{row.name}</span>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    sortable: true,
    render: (row) => (
      <span className="text-muted-foreground text-xs">{row.client}</span>
    ),
  },
  {
    key: 'mw',
    header: 'MW',
    width: '72px',
    sortable: true,
    align: 'right',
    render: (row) => (
      <span className="tabular-nums font-mono text-xs">
        {row.mw > 0 ? `${row.mw} MW` : '—'}
      </span>
    ),
  },
  {
    key: 'budget',
    header: 'Budget',
    width: '110px',
    sortable: true,
    align: 'right',
    render: (row) => (
      <span className="tabular-nums font-mono text-xs">{fmt.format(row.budget)}</span>
    ),
  },
  {
    key: 'gate',
    header: 'Gate',
    width: '68px',
    sortable: true,
    align: 'center',
    render: (row) => (
      <Badge variant="gate">G{row.gate}</Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '130px',
    sortable: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'priority',
    header: 'Priority',
    width: '90px',
    sortable: true,
    render: (row) => <PriorityBadge priority={row.priority} />,
  },
  {
    key: 'pm',
    header: 'Project Manager',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-muted-foreground">{row.pm}</span>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-muted-foreground">{row.location}</span>
    ),
  },
]

/* ── Demo component ────────────────────────────────────────── */

export function DataRegisterDemo() {
  const [selected,   setSelected]   = React.useState<ProjectRow | null>(null)
  const [loading,    setLoading]    = React.useState(false)
  const [showError,  setShowError]  = React.useState(false)

  function simulateLoad() {
    setLoading(true)
    setShowError(false)
    setTimeout(() => setLoading(false), 1800)
  }

  function simulateError() {
    setShowError((v) => !v)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Demo controls:</span>
        <Button size="sm" variant="outline" onClick={simulateLoad} loading={loading}>
          Simulate loading
        </Button>
        <Button
          size="sm"
          variant={showError ? 'danger' : 'outline'}
          onClick={simulateError}
        >
          {showError ? 'Clear error' : 'Simulate error'}
        </Button>
      </div>

      {/* Selected row detail */}
      {selected && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-lg border border-border bg-accent/60 px-4 py-2.5 text-sm"
        >
          <span>
            Row clicked:{' '}
            <span className="font-semibold text-foreground">{selected.name}</span>
            {' '}
            <span className="text-muted-foreground">({selected.code})</span>
          </span>
          <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* The register */}
      <DataRegister<ProjectRow>
        title="Project Register"
        data={MOCK_PROJECTS}
        columns={COLUMNS}
        searchFields={['code', 'name', 'client', 'pm', 'location']}
        searchPlaceholder="Search projects…"
        rowKey="id"
        pageSize={8}
        loading={loading}
        error={showError ? 'Failed to load project data. Please check your connection and try again.' : null}
        emptyMessage="No projects match your search."
        onRowClick={setSelected}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => alert('Exporting CSV…')}>
              <Download className="size-3.5" />
              <span className="hidden sm:inline ml-1">Export</span>
            </Button>
            <Button size="sm" onClick={() => alert('Open create modal…')}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline ml-1">New Project</span>
            </Button>
          </>
        )}
      />
    </div>
  )
}
