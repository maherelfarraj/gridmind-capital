import { Zap, AlertTriangle } from 'lucide-react'

export const metadata = { title: 'Authentication Error — GridMind Capital' }

export default function AuthErrorPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-red-500/5 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00dc82] to-emerald-400 shadow-lg shadow-[#00dc82]/25">
              <Zap className="size-5 text-slate-950" aria-hidden />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">GridMind Capital</span>
          </a>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-sm">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
            <AlertTriangle className="size-8 text-red-400" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-white">Authentication error</h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            Something went wrong during authentication. This link may have expired or already been used.
          </p>
          <a href="/auth/login"
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-[#00dc82] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#00dc82]/90">
            Back to sign in
          </a>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} GridMind Capital. All rights reserved.
        </p>
      </div>
    </div>
  )
}
