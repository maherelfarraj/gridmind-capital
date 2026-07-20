'use client'

import * as React from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/* ── Mock auth ──────────────────────────────── */
async function mockSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  await new Promise((r) => setTimeout(r, 1600))
  if (password === 'wrong') return { ok: false, error: 'Invalid email or password. Please try again.' }
  if (!email.includes('@')) return { ok: false, error: 'Please enter a valid email address.' }
  return { ok: true }
}

/* ── Validation ─────────────────────────────── */
function validateEmail(v: string) {
  if (!v.trim()) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.'
  return ''
}
function validatePassword(v: string) {
  if (!v) return 'Password is required.'
  if (v.length < 6) return 'Password must be at least 6 characters.'
  return ''
}

/* ── Inner form (needs toast context) ───────── */
function LoginForm() {
  const { toast } = useToast()

  const [email, setEmail]         = React.useState('')
  const [password, setPassword]   = React.useState('')
  const [remember, setRemember]   = React.useState(false)
  const [showPw, setShowPw]       = React.useState(false)
  const [loading, setLoading]     = React.useState(false)
  const [success, setSuccess]     = React.useState(false)
  const [touched, setTouched]     = React.useState({ email: false, password: false })

  const emailErr    = touched.email    ? validateEmail(email)       : ''
  const passwordErr = touched.password ? validatePassword(password) : ''
  const isValid     = !validateEmail(email) && !validatePassword(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!isValid) return

    setLoading(true)
    try {
      const result = await mockSignIn(email, password)
      if (!result.ok) {
        toast({
          variant: 'danger',
          title: 'Sign-in failed',
          description: result.error,
          duration: 6000,
        })
        setLoading(false)
        return
      }
      setSuccess(true)
      toast({
        variant: 'gate',
        title: 'Welcome back!',
        description: `Signed in as ${email}`,
        duration: 4000,
      })
      // Simulate redirect delay
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      toast({ variant: 'danger', title: 'Network error', description: 'Please check your connection and try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f8fafc] px-4 py-12 dark:bg-[#0a192f]">
      {/* Background texture — subtle grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03] dark:opacity-[0.05]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(#0a192f 1px, transparent 1px), linear-gradient(to right, #0a192f 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-[400px] animate-[slide-up_0.3s_cubic-bezier(0.16,1,0.3,1)]">

        {/* ── Logo section ── */}
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Icon circle */}
          <div
            className={cn(
              'mb-5 flex size-16 items-center justify-center rounded-2xl bg-[#0a192f] shadow-[0_0_0_1px_rgba(100,255,218,0.3),0_8px_32px_rgba(10,25,47,0.4)]',
              'dark:bg-[#112240] dark:shadow-[0_0_0_1px_rgba(100,255,218,0.2),0_8px_32px_rgba(100,255,218,0.08)]',
            )}
            aria-hidden="true"
          >
            <Zap className="size-8 text-[#64ffda]" strokeWidth={2.5} />
          </div>

          <h1 className="font-sans text-2xl font-bold tracking-tight text-[#0a192f] dark:text-[#ccd6f6]">
            GridMind Capital
          </h1>
          <p className="mt-1 font-sans text-sm text-[#64748b] dark:text-[#8892b0]">
            Renewable EPC Enterprise Operating System
          </p>
          <Badge variant="gate" className="mt-3">
            Enterprise Edition
          </Badge>
        </div>

        {/* ── Card ── */}
        <div
          className={cn(
            'rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-[0_4px_24px_rgba(10,25,47,0.08)]',
            'dark:border-[rgba(100,255,218,0.1)] dark:bg-[#112240] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
          )}
        >
          {/* Success overlay */}
          {success && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-card/95 backdrop-blur-sm">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#64ffda]/10">
                <ShieldCheck className="size-7 text-[#64ffda]" />
              </div>
              <p className="font-sans text-sm font-semibold text-foreground">Signing you in…</p>
              <div className="h-1 w-32 overflow-hidden rounded-full bg-border">
                <div className="h-full w-full origin-left animate-[slide-up_1.5s_ease-in-out] bg-[#64ffda]" />
              </div>
            </div>
          )}

          <h2 className="mb-6 font-sans text-lg font-semibold text-[#0a192f] dark:text-[#ccd6f6]">
            Sign in
          </h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <Input
              type="email"
              label="Email address"
              placeholder="you@company.com"
              autoComplete="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={emailErr}
              leadingIcon={<Mail />}
              disabled={loading || success}
            />

            {/* Password */}
            <div className="space-y-1.5">
              <Input
                type={showPw ? 'text' : 'password'}
                label="Password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                error={passwordErr}
                leadingIcon={<Lock />}
                trailingIcon={
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPw((v) => !v)}
                    className="pointer-events-auto text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
                disabled={loading || success}
              />
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading || success}
                  className={cn(
                    'size-4 rounded border-border bg-background',
                    'accent-[#64ffda] cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
                <span className="font-sans text-sm text-[#64748b] dark:text-[#8892b0]">
                  Remember me
                </span>
              </label>

              <button
                type="button"
                className={cn(
                  'font-sans text-sm font-medium text-[#0a192f] underline-offset-2',
                  'hover:underline dark:text-[#64ffda]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                )}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="default"
              size="lg"
              loading={loading}
              disabled={loading || success}
              className="w-full gap-2"
            >
              {!loading && <ArrowRight className="size-4" aria-hidden="true" />}
              Sign in
            </Button>
          </form>

          {/* Demo hint */}
          <p className="mt-4 text-center font-sans text-xs text-muted-foreground">
            Demo: any valid email + any password (use &quot;wrong&quot; to test error state)
          </p>
        </div>

        {/* ── Footer ── */}
        <p className="mt-6 text-center font-sans text-sm text-[#64748b] dark:text-[#8892b0]">
          Don&apos;t have an account?{' '}
          <span className="font-medium text-[#0a192f] dark:text-[#ccd6f6]">
            Contact your admin
          </span>
        </p>

        {/* Version tag */}
        <p className="mt-3 text-center font-mono text-[11px] text-[#94a3b8] dark:text-[#4a5568]">
          GridMind Capital v3.0 · Enterprise
        </p>
      </div>
    </div>
  )
}

/* ── Page export (wraps with ToastProvider) ─── */
export function LoginPage() {
  return (
    <ToastProvider position="top-center">
      <LoginForm />
    </ToastProvider>
  )
}
