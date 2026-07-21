import Link from 'next/link'
import { FileSearch, ArrowLeft, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-lg w-full">

        {/* Logomark */}
        <div className="mx-auto mb-8 size-20 rounded-2xl bg-[#64ffda]/8 border border-[#64ffda]/20 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="3"  y="3"  width="10" height="10" rx="2" fill="#64ffda" />
            <rect x="15" y="3"  width="10" height="10" rx="2" fill="#64ffda" opacity="0.55" />
            <rect x="3"  y="15" width="10" height="10" rx="2" fill="#64ffda" opacity="0.55" />
            <rect x="15" y="15" width="10" height="10" rx="2" fill="#64ffda" opacity="0.25" />
          </svg>
        </div>

        {/* 404 */}
        <p className="text-[5rem] font-black leading-none text-[#64ffda]/15 mb-2 select-none" aria-hidden>
          404
        </p>

        <div className="flex items-center justify-center gap-2.5 mb-3">
          <FileSearch className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-bold text-foreground">Page not found</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8 text-balance">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL or navigate back to the dashboard.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#64ffda] text-[#0a192f] text-sm font-semibold hover:bg-[#64ffda]/90 transition-colors"
          >
            <LayoutDashboard className="size-4" aria-hidden />
            Go to dashboard
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden />
            View projects
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-wider">Quick links</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: 'Approvals',    href: '/approvals'    },
              { label: 'Documents',    href: '/documents'    },
              { label: 'Stage Gates',  href: '/stage-gates'  },
              { label: 'Finance',      href: '/finance'      },
              { label: 'Admin',        href: '/admin/tenant' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-[#64ffda]/40 hover:bg-[#64ffda]/5 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
