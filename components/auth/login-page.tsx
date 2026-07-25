'use client'

import * as React from 'react'
import {
  Zap, Mail, Lock, Eye, EyeOff, ShieldCheck, Users, FileCheck, Brain,
  AlertTriangle, CheckCircle, X, Loader2,
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Mock auth — exact credentials from spec
───────────────────────────────────────────── */
async function mockLogin(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  await new Promise((r) => setTimeout(r, 1500))
  if (email === 'admin@gridmind.capital' && password === 'Admin123!')
    return { success: true }
  if (email === 'pm@gridmind.capital' && password === 'PM123!')
    return { success: true }
  return { success: false, error: 'Invalid email or password. Please try again.' }
}

/* ─────────────────────────────────────────────
   Validation helpers
───────────────────────────────────────────── */
// Return a translation key ('' = valid) so the component can localise the message.
function validateEmail(v: string): '' | 'emailInvalid' {
  if (!v.trim()) return 'emailInvalid'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'emailInvalid'
  return ''
}
function validatePassword(v: string): '' | 'passwordTooShort' {
  if (!v) return 'passwordTooShort'
  if (v.length < 6) return 'passwordTooShort'
  return ''
}

/* ─────────────────────────────────────────────
   Toast types
───────────────────────────────────────────── */
interface ToastItem {
  id: string
  type: 'error' | 'success'
  title: string
  message: string
}

/* ─────────────────────────────────────────────
   Microsoft icon (4 colored squares)
───────────────────────────────────────────── */
function MicrosoftIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Google icon (colorful G)
───────────────────────────────────────────── */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Toast component
───────────────────────────────────────────── */
function Toast({
  item,
  onDismiss,
  errorTitle,
  successTitle,
  dismissLabel,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
  errorTitle: string
  successTitle: string
  dismissLabel: string
}) {
  React.useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 5000)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
    >
      {item.type === 'error' ? (
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden="true" />
      ) : (
        <CheckCircle className="mt-0.5 size-5 shrink-0 text-green-500" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          {item.type === 'error' ? errorTitle : successTitle}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{item.message}</p>
      </div>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Left panel feature list
───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <ShieldCheck className="size-5 text-green-400" aria-hidden="true" />,
    titleKey: 'features.gateSystem',
    descKey: 'features.gateSystemDesc',
  },
  {
    icon: <Users className="size-5 text-blue-400" aria-hidden="true" />,
    titleKey: 'features.multiTenant',
    descKey: 'features.multiTenantDesc',
  },
  {
    icon: <FileCheck className="size-5 text-amber-400" aria-hidden="true" />,
    titleKey: 'features.auditTrails',
    descKey: 'features.auditTrailsDesc',
  },
  {
    icon: <Brain className="size-5 text-purple-400" aria-hidden="true" />,
    titleKey: 'features.aiAnalytics',
    descKey: 'features.aiAnalyticsDesc',
  },
] as const

/* ─────────────────────────────────────────────
   Field error display
───────────────────────────────────────────── */
function FieldError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 text-xs text-red-500">
      {message}
    </p>
  )
}

/* ─────────────────────────────────────────────
   Public props interface (spec-exact)
───────────────────────────────────────────── */
export interface LoginPageProps {
  /** Called when the user submits email + password. Omit to use the built-in mock. */
  onLogin?: (email: string, password: string) => Promise<void>
  /** Called when the user chooses an SSO provider. Omit to use the built-in mock. */
  onSSOLogin?: (provider: 'microsoft' | 'google') => Promise<void>
  /** External error message (e.g. from a server action). Displayed as a toast. */
  error?: string | null
  /** External loading flag. Merged with internal loading state. */
  isLoading?: boolean
}

/* ─────────────────────────���───────────────────
   Main LoginPage
───────────────────────────────────────────── */
export function LoginPage({
  onLogin,
  onSSOLogin,
  error: externalError,
  isLoading: externalLoading = false,
}: LoginPageProps = {}) {
  const t = useTranslations('auth.login')
  const tAuth = useTranslations('auth')
  const locale = useLocale()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  /* form state */
  const [email, setEmail]         = React.useState('')
  const [password, setPassword]   = React.useState('')
  const [remember, setRemember]   = React.useState(false)
  const [showPw, setShowPw]       = React.useState(false)
  const [loading, setLoading]     = React.useState(false)
  const [success, setSuccess]     = React.useState(false)
  const [touched, setTouched]     = React.useState({ email: false, password: false })
  const [shake, setShake]         = React.useState(false)
  const [toasts, setToasts]       = React.useState<ToastItem[]>([])

  const isLoading   = loading || externalLoading

  // Validators return translation keys ('' = valid); translate for display.
  const emailErrKey    = touched.email    ? validateEmail(email)       : ''
  const passwordErrKey = touched.password ? validatePassword(password) : ''
  const emailErr       = emailErrKey    ? t(emailErrKey)    : ''
  const passwordErr    = passwordErrKey ? t(passwordErrKey) : ''
  const isFormValid = !validateEmail(email) && !validatePassword(password)

  /* Surface external errors as toasts */
  React.useEffect(() => {
    if (externalError) addToast('error', externalError)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalError])

  function addToast(type: ToastItem['type'], message: string) {
    const id = String(Date.now())
    setToasts((prev) => [...prev, { id, type, title: '', message }])
  }

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!isFormValid) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    setLoading(true)
    try {
      if (onLogin) {
        /* Delegate to caller — caller is responsible for redirect */
        await onLogin(email, password)
        setSuccess(true)
        addToast('success', t('signedInSuccess'))
      } else {
        /* Built-in mock for demo / standalone usage */
        const result = await mockLogin(email, password)
        if (!result.success) {
          addToast('error', t('invalidCredentials'))
          setLoading(false)
          return
        }
        setSuccess(true)
        addToast('success', t('redirecting'))
        setTimeout(() => { window.location.href = '/dashboard' }, 1800)
      }
    } catch {
      addToast('error', t('networkError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSSOLogin(provider: 'microsoft' | 'google') {
    setLoading(true)
    try {
      if (onSSOLogin) {
        await onSSOLogin(provider)
        setSuccess(true)
        addToast('success', provider === 'microsoft' ? t('ssoSignedInMicrosoft') : t('ssoSignedInGoogle'))
      } else {
        await new Promise((r) => setTimeout(r, 1200))
        addToast('error', t('ssoNotConfigured'))
      }
    } catch {
      addToast('error', provider === 'microsoft' ? t('ssoFailedMicrosoft') : t('ssoFailedGoogle'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir={dir} className="h-screen w-full overflow-hidden bg-slate-50">

      {/* ── Toast stack — fixed top-inline-end ── */}
      <div
        className="fixed end-4 top-4 z-50 flex flex-col gap-2"
        aria-label={t('notifications')}
      >
        {toasts.map((toastItem) => (
          <Toast
            key={toastItem.id}
            item={toastItem}
            onDismiss={dismissToast}
            errorTitle={tAuth('loginFailed')}
            successTitle={tAuth('welcomeBack')}
            dismissLabel={t('dismiss')}
          />
        ))}
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid h-full lg:grid-cols-2">

        {/* ── Left panel (desktop only) ── */}
        <div className="relative hidden h-full flex-col items-center justify-center bg-[#0a192f] lg:flex">
          {/* subtle grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative flex flex-col items-center px-12">
            {/* Logo */}
            <div className="flex size-20 items-center justify-center rounded-full bg-white/10">
              <Zap className="size-8 text-white" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-white">{t('brand')}</h1>
            <p className="mt-2 text-lg text-slate-300 text-center text-balance">
              {t('productName')}
            </p>
            <span className="mt-4 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              {t('edition')}
            </span>

            {/* Feature list */}
            <div className="mt-12 w-full max-w-md">
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
                {t('whyTitle')}
              </p>
              <div className="flex flex-col gap-4">
                {FEATURES.map((f) => (
                  <div key={f.titleKey} className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{f.icon}</div>
                    <div>
                      <p className="text-sm font-medium text-white">{t(f.titleKey)}</p>
                      <p className="text-xs text-slate-400">{t(f.descKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Left panel footer */}
          <p className="absolute bottom-8 start-8 text-xs text-slate-500">
            {t('copyright')}
          </p>
        </div>

        {/* ── Right panel ── */}
        <div className="flex h-full items-center justify-center overflow-y-auto px-6 py-8">
          <div className="w-full max-w-md">

            {/* ── Login card ── */}
            <div
              className={cn(
                'rounded-xl border border-slate-200 bg-white p-8 shadow-lg',
                shake && 'animate-[shake_0.4s_ease-in-out]',
              )}
            >
              {/* Mobile-only logo */}
              <div className="mb-6 flex flex-col items-center text-center lg:hidden">
                <div className="flex size-14 items-center justify-center rounded-full bg-[#0a192f]/10">
                  <Zap className="size-7 text-[#0a192f]" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <h1 className="mt-4 text-xl font-bold text-slate-900">{t('brand')}</h1>
                <p className="mt-1 text-sm text-slate-500">{t('heading')}</p>
              </div>

              {/* Desktop heading */}
              <h2 className="hidden text-2xl font-bold text-slate-900 lg:block">
                {t('heading')}
              </h2>
              <p className="mt-1 hidden text-sm text-slate-500 lg:block">
                {t('subtitle')}
              </p>

              {/* ── Form ── */}
              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-6 space-y-4"
                aria-label={t('formLabel')}
              >
                {/* Email */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    {tAuth('email')}
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('emailPlaceholder')}
                      dir="ltr"
                      required
                      disabled={isLoading || success}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                      className={cn(
                        'w-full rounded-lg border bg-white py-2.5 ps-9 pe-3 text-sm text-slate-900',
                        'placeholder:text-slate-400 outline-none transition-colors',
                        'focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        emailErr
                          ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
                          : 'border-slate-200',
                      )}
                    />
                  </div>
                  <FieldError message={emailErr} />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    {tAuth('password')}
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="login-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                      disabled={isLoading || success}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                      className={cn(
                        'w-full rounded-lg border bg-white py-2.5 ps-9 pe-10 text-sm text-slate-900',
                        'placeholder:text-slate-400 outline-none transition-colors',
                        'focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        passwordErr
                          ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
                          : 'border-slate-200',
                      )}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPw ? t('hidePassword') : t('showPassword')}
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                    >
                      {showPw
                        ? <EyeOff className="size-4" aria-hidden="true" />
                        : <Eye    className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <FieldError message={passwordErr} />
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-sky-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                    >
                      {tAuth('forgotPassword')}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-2">
                  <input
                    id="login-remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={isLoading || success}
                    className="size-4 cursor-pointer rounded border-slate-300 accent-[#0a192f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a192f]"
                  />
                  <label
                    htmlFor="login-remember"
                    className="cursor-pointer select-none text-sm text-slate-600"
                  >
                    {t('rememberMe')}
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || success}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg bg-[#0a192f] px-4 py-3',
                    'text-sm font-semibold text-white transition-colors',
                    'hover:bg-slate-800',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a192f] focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {tAuth('signingIn')}
                    </>
                  ) : (
                    tAuth('signIn')
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs uppercase text-slate-400">{t('or')}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {/* SSO buttons */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleSSOLogin('microsoft')}
                  disabled={isLoading || success}
                  className={cn(
                    'flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200',
                    'bg-white px-4 py-3 text-sm font-medium text-slate-700',
                    'hover:bg-slate-50 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <MicrosoftIcon size={20} />
                  {t('ssoMicrosoft')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSSOLogin('google')}
                  disabled={isLoading || success}
                  className={cn(
                    'flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200',
                    'bg-white px-4 py-3 text-sm font-medium text-slate-700',
                    'hover:bg-slate-50 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <GoogleIcon size={20} />
                  {t('ssoGoogle')}
                </button>
              </div>

              {/* Card footer */}
              <p className="mt-6 text-center text-sm text-slate-500">
                {tAuth('noAccount')}{' '}
                <a
                  href="/auth/sign-up"
                  className="text-sky-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                >
                  {tAuth('createAccount')}
                </a>
              </p>

              {/* Demo hint */}
              <p className="mt-3 text-center text-xs text-slate-400" dir="ltr">
                {t('demoHint')}
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
