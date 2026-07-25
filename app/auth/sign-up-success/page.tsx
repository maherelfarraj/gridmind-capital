import Link from 'next/link'
import { Zap, Mail, CheckCircle } from 'lucide-react'

export const metadata = { title: 'Check Your Email — GridMind Capital' }

export default function SignUpSuccessPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-[#00dc82]/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00dc82] to-emerald-400 shadow-lg shadow-[#00dc82]/25">
              <Zap className="size-5 text-slate-950" aria-hidden />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">GridMind Capital</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-sm">
          {/* Icon */}
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-[#00dc82]/10 ring-1 ring-[#00dc82]/20">
            <Mail className="size-8 text-[#00dc82]" aria-hidden />
          </div>

          <div className="mb-2 flex items-center justify-center gap-2 text-[#00dc82]">
            <CheckCircle className="size-5" aria-hidden />
            <span className="text-sm font-semibold tracking-wide uppercase">Account created</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold text-white">Check your email</h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            We&apos;ve sent a confirmation link to your email address.
            Click the link to verify your account and get started.
          </p>

          <div className="mt-6 rounded-xl border border-white/8 bg-white/3 p-4 text-left space-y-2">
            <p className="text-xs font-medium text-slate-300">What to expect:</p>
            {[
              'Check your inbox (and spam folder)',
              'Click the confirmation link',
              'You\'ll be redirected back to sign in',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#00dc82]/15 text-[#00dc82] font-bold text-[10px]">{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <a
            href="/auth/login"
            className="mt-6 flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10">
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
