'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Menu, Code2, ExternalLink, Moon } from 'lucide-react'
import { DocSidebar } from './doc-sidebar'
import { DocContent } from './doc-content'
import { ApiTesterModal } from './api-tester-modal'
import type { Endpoint } from './types'

export function DevPortal() {
  const router       = useSearchParams()
  const [section, setSection]       = React.useState('introduction')
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [testerEndpoint, setTester] = React.useState<Endpoint | null>(null)
  const [copyToast, setCopyToast]   = React.useState(false)

  // Scroll spy: attach IntersectionObserver to h2 elements in content
  const contentRef = React.useRef<HTMLDivElement>(null)

  function handleSelect(id: string) {
    setSection(id)
    setMobileOpen(false)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex h-screen bg-[#0a0e1a] overflow-hidden font-sans">
      {/* Sidebar */}
      <DocSidebar
        activeSection={section}
        onSelect={handleSelect}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#0a0e1a]/90 backdrop-blur-sm z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            {/* Mobile logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center">
                <Code2 size={12} className="text-white" />
              </div>
              <span className="text-sm font-bold text-white">GridMind API</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://app.gridmind.capital"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ExternalLink size={11} />
              Dashboard
            </a>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Status: Operational
            </div>
          </div>
        </header>

        {/* Content area */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-6 py-8">
            <DocContent section={section} onTryIt={ep => setTester(ep)} />
          </div>
          {/* Bottom padding for scroll */}
          <div className="h-24" />
        </main>
      </div>

      {/* API Tester modal */}
      <ApiTesterModal endpoint={testerEndpoint} onClose={() => setTester(null)} />
    </div>
  )
}
