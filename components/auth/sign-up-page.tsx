'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, Mail, Lock, Eye, EyeOff, User, AlertTriangle, CheckCircle, X, Loader2, Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ─── Validation ───────────────────────────────────────────────── */
function validateEmail(v: string) {
  if (!v.trim()) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email address.'
  return ''
}
function validatePassword(v: string) {
  if (!v) return 'Password is required.'
  if (v.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(v)) return 'Must contain at least one uppercase letter.'
  if (!/[0-9]/.test(v)) return 'Must contain at least one number.'
  return ''
}
function validateName(v: string) {
  if (!v.trim()) return 'Full name is required.'
  if (v.trim().split(' ').length < 2) return 'Please enter your first and last name.'
  return ''
}

/* ─── Toast ────────────────────────────────────────────────────── */
interface ToastItem { id: string; type: 'error' | 'success'; title: string; message: string }

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  React.useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 6000)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])
  return (
    <div role="alert" aria-live="assertive"
      className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
      {item.type === 'error'
        ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden />
        : <CheckCircle  className="mt-0.5 size-5 shrink-0 text-green-500" aria-hidden />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{item.message}</p>
      </div>
      <button onClick={() => onDismiss(item.id)} className="shrink-0 text-slate-400 hover:text-slate-600"
        aria-label="Dismiss notification">
        <X className="size-4" />
      </button>
    </div>
  )
}

/* ─── Password strength bar ────────────────────────────────────── */
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score]
  const colors = ['', 'bg-red-500', 'bg-amber-400', 'bg-yellow-400', 'bg-emerald-500']
  if (!password) return null
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors',
            i <= score ? colors[score] : 'bg-slate-200')} />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Strength: <span className={cn('font-medium', score >= 3 ? 'text-emerald-600' : 'text-slate-700')}>{label}</span>
      </p>
    </div>
  )
}

/* ─── Sign-Up Page ─────────────────────────────────────────────── */
export function SignUpPage() {
  const router = useRouter()
  const [form, setForm]       = React.useState({ name: '', email: '', password: '', confirm: '', organisation: '' })
  const [errors, setErrors]   = React.useState<Record<string, string>>({})
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [showPw, setShowPw]   = React.useState(false)
  const [showCf, setShowCf]   = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [toasts, setToasts]   = React.useState<ToastItem[]>([])

  function addToast(toast: Omit<ToastItem, 'id'>) {
    setToasts(prev => [...prev, { ...toast, id: Math.random().toString(36).slice(2) }])
  }
  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function validate(field: string, value: string) {
    if (field === 'name')     return validateName(value)
    if (field === 'email')    return validateEmail(value)
    if (field === 'password') return validatePassword(value)
    if (field === 'confirm')  return value !== form.password ? 'Passwords do not match.' : ''
    return ''
  }

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validate(field, value) }))
    }
    // re-validate confirm when password changes
    if (field === 'password' && touched['confirm']) {
      setErrors(prev => ({ ...prev, confirm: form.confirm !== value ? 'Passwords do not match.' : '' }))
    }
  }

  function handleBlur(field: string) {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErrors(prev => ({ ...prev, [field]: validate(field, form[field as keyof typeof form]) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fields = ['name', 'email', 'password', 'confirm'] as const
    const newErrors: Record<string, string> = {}
    fields.forEach(f => { newErrors[f] = validate(f, form[f]) })
    setErrors(newErrors)
    setTouched({ name: true, email: true, password: true, confirm: true })
    if (Object.values(newErrors).some(Boolean)) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: form.name.trim(),
            organisation: form.organisation.trim() || undefined,
          },
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        addToast({ type: 'error', title: 'Sign up failed', message: error.message })
        return
      }
      router.push('/auth/sign-up-success')
    } catch {
      addToast({ type: 'error', title: 'Sign up failed', message: 'An unexpected error occurred. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const inputBase = 'w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2'
  const inputOk   = 'border-slate-200 focus:border-[#00dc82] focus:ring-[#00dc82]/20'
  const inputErr  = 'border-red-300 focus:border-red-400 focus:ring-red-400/20 bg-red-50/50'

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-[#00dc82]/8 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end" aria-live="polite">
        {toasts.map(t => <Toast key={t.id} item={t} onDismiss={dismissToast} />)}
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00dc82] to-emerald-400 shadow-lg shadow-[#00dc82]/25">
              <Zap className="size-5 text-slate-950" aria-hidden />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">GridMind Capital</span>
          </a>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="mt-1 text-sm text-slate-400">Join the GridMind Capital platform</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-300">
                Full name <span className="text-red-400" aria-hidden>*</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden />
                <input
                  id="name" type="text" autoComplete="name" required
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-err' : undefined}
                  className={cn(inputBase, 'pl-10', touched.name && errors.name ? inputErr : inputOk)}
                />
              </div>
              {touched.name && errors.name && (
                <p id="name-err" className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3" aria-hidden />{errors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-300">
                Work email <span className="text-red-400" aria-hidden>*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden />
                <input
                  id="email" type="email" autoComplete="email" required
                  placeholder="jane@yourcompany.com"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-err' : undefined}
                  className={cn(inputBase, 'pl-10', touched.email && errors.email ? inputErr : inputOk)}
                />
              </div>
              {touched.email && errors.email && (
                <p id="email-err" className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3" aria-hidden />{errors.email}
                </p>
              )}
            </div>

            {/* Organisation (optional) */}
            <div>
              <label htmlFor="org" className="mb-1.5 block text-xs font-medium text-slate-300">
                Organisation <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden />
                <input
                  id="org" type="text" autoComplete="organization"
                  placeholder="Acme Renewables Ltd"
                  value={form.organisation}
                  onChange={e => handleChange('organisation', e.target.value)}
                  className={cn(inputBase, 'pl-10', inputOk)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-300">
                Password <span className="text-red-400" aria-hidden>*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden />
                <input
                  id="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'pw-err' : undefined}
                  className={cn(inputBase, 'pl-10 pr-10', touched.password && errors.password ? inputErr : inputOk)}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
              {touched.password && errors.password && (
                <p id="pw-err" className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3" aria-hidden />{errors.password}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-slate-300">
                Confirm password <span className="text-red-400" aria-hidden>*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden />
                <input
                  id="confirm" type={showCf ? 'text' : 'password'} autoComplete="new-password" required
                  placeholder="Re-enter your password"
                  value={form.confirm}
                  onChange={e => handleChange('confirm', e.target.value)}
                  onBlur={() => handleBlur('confirm')}
                  aria-invalid={!!errors.confirm}
                  aria-describedby={errors.confirm ? 'cf-err' : undefined}
                  className={cn(inputBase, 'pl-10 pr-10', touched.confirm && errors.confirm ? inputErr : inputOk)}
                />
                <button type="button" onClick={() => setShowCf(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  aria-label={showCf ? 'Hide confirm password' : 'Show confirm password'}>
                  {showCf ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {touched.confirm && errors.confirm && (
                <p id="cf-err" className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3" aria-hidden />{errors.confirm}
                </p>
              )}
            </div>

            {/* Terms */}
            <p className="text-xs text-slate-500">
              By creating an account you agree to our{' '}
              <a href="#" className="text-[#00dc82] hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-[#00dc82] hover:underline">Privacy Policy</a>.
            </p>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#00dc82] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#00dc82]/90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00dc82]/50">
              {loading
                ? <><Loader2 className="size-4 animate-spin" aria-hidden />Creating account&hellip;</>
                : 'Create account'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">Already have an account?</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <a href="/auth/login"
            className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10">
            Sign in instead
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} GridMind Capital. All rights reserved.
        </p>
      </div>
    </div>
  )
}
