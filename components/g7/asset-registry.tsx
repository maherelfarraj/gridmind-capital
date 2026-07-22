'use client'
import React from 'react'
import {
  Search, Download, QrCode, X, ChevronDown, CheckCircle2,
  Circle, Wrench, FileText, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Asset, AssetCategory } from './types'

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  Electrical: 'bg-blue-100 text-blue-700',
  Mechanical: 'bg-amber-100 text-amber-700',
  Civil:      'bg-stone-100 text-stone-700',
  IT:         'bg-purple-100 text-purple-700',
  Safety:     'bg-red-100 text-red-700',
}

const CATEGORIES: AssetCategory[] = ['Electrical', 'Mechanical', 'Civil', 'IT', 'Safety']

function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  return diff
}

function WarrantyBadge({ expiry }: { expiry: string }) {
  const days = daysUntil(expiry)
  const years = (days / 365).toFixed(1)
  const cls = days > 730 ? 'bg-emerald-100 text-emerald-700'
    : days > 365         ? 'bg-amber-100 text-amber-700'
    :                      'bg-red-100 text-red-700'
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', cls)}>
      {days > 0 ? `${years} yrs` : 'Expired'}
    </span>
  )
}

export function AssetRegistry({ assets: initialAssets }: { assets: Asset[] }) {
  const [assets, setAssets] = React.useState(initialAssets)
  const [search, setSearch] = React.useState('')
  const [catFilter, setCatFilter] = React.useState<AssetCategory | 'All'>('All')
  const [selected, setSelected] = React.useState<Asset | null>(null)
  const [qrProgress, setQrProgress] = React.useState<number | null>(null)

  const filtered = assets.filter((a) => {
    const q = search.toLowerCase()
    const matchQ = !q || a.asset_id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.location.toLowerCase().includes(q)
    const matchC = catFilter === 'All' || a.category === catFilter
    return matchQ && matchC
  })

  function toggleOperational(id: string) {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, is_operational: !a.is_operational } : a))
    if (selected?.id === id) setSelected((s) => s ? { ...s, is_operational: !s.is_operational } : s)
  }

  function generateQR() {
    setQrProgress(0)
    const interval = setInterval(() => {
      setQrProgress((p) => {
        if (p === null || p >= 100) { clearInterval(interval); return null }
        return Math.min(p + 8, 100)
      })
    }, 120)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-800">Asset Registry</h2>
          <p className="text-sm text-slate-500 mt-0.5">{assets.length} assets — {assets.filter((a) => a.is_operational).length} operational</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={generateQR}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <QrCode size={13} /> Generate QR Codes
          </button>
          <button type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* QR progress */}
      {qrProgress !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Generating QR codes…</span><span>{qrProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-200" style={{ width: `${qrProgress}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets…"
            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 w-44" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['All', ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCatFilter(c)}
              className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                catFilter === c ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
              {['Asset ID', 'Name', 'Category', 'Location', 'Condition', 'Warranty', 'Status', 'Manual', ''].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                onClick={() => setSelected(a)}>
                <td className="px-3 py-2.5 font-mono text-xs text-emerald-700 font-semibold">{a.asset_id}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[160px] truncate">{a.name}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', CATEGORY_COLORS[a.category])}>{a.category}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{a.location}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{a.condition}</td>
                <td className="px-3 py-2.5"><WarrantyBadge expiry={a.warranty_expiry} /></td>
                <td className="px-3 py-2.5">
                  {a.is_operational
                    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> Operational</span>
                    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><Circle size={10} /> Pending</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  {a.om_manual_url
                    ? <a href={a.om_manual_url} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:underline"><FileText size={11} /> View</a>
                    : <span className="text-[10px] text-slate-300">—</span>
                  }
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-[10px]">Details →</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">No assets match the current filter.</div>
        )}
      </div>

      {/* Asset detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-y-auto max-h-[85vh]">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{selected.asset_id}</p>
                <h3 className="text-base font-bold text-slate-800">{selected.name}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Operational toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Wrench size={15} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Mark as Operational</span>
                </div>
                <button type="button" onClick={() => toggleOperational(selected.id)}
                  className={cn('transition-colors', selected.is_operational ? 'text-emerald-600' : 'text-slate-300')}>
                  {selected.is_operational ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              {/* Specs */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Specifications</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selected.specs).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k}</p>
                      <p className="text-sm font-semibold text-slate-700">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                {[
                  ['Manufacturer', selected.manufacturer],
                  ['Model', selected.model],
                  ['Serial No.', selected.serial_number],
                  ['Installed', selected.installation_date],
                  ['Warranty Expires', selected.warranty_expiry],
                  ['Location', selected.location],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-slate-400 uppercase text-[10px] tracking-wider">{k}</p><p className="font-medium text-slate-700">{v}</p></div>
                ))}
              </div>

              {/* Maintenance tasks */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Maintenance Schedule</p>
                <div className="space-y-2">
                  {selected.maintenance_tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{t.description}</p>
                        <p className="text-[10px] text-slate-400">{t.frequency}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Next due</p>
                        <p className="text-xs font-semibold text-amber-600">{t.next_due}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
