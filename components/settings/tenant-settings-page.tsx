'use client'

import * as React from 'react'
import {
  Building2,
  Globe,
  Bell,
  Shield,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Lock,
  Mail,
  Smartphone,
  Monitor,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  Pause,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Public types (spec-exact)
───────────────────────────────────────────── */
export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  status: 'active' | 'suspended' | 'trial' | 'churned'
  created_at?: string
}

export interface TenantSettings {
  name: string
  slug: string
  plan: string
  status: string
  timezone: string
  date_format: string
  language: string
  default_currency: string
  approval_threshold_low: number
  approval_threshold_medium: number
  approval_threshold_high: number
  auto_escalation_hours: number
  escalation_target: string
  notifications_email: boolean
  notifications_push: boolean
  notifications_in_app: boolean
  notifications_sms: boolean
  email_priority: string
  push_priority: string
  in_app_priority: string
  sso_provider: string
  mfa_required: boolean
  session_timeout: string
  max_concurrent_sessions: number
}

export interface TenantSettingsProps {
  /** Live tenant record — drives read-only identity fields (slug, plan, status). */
  tenant?: Tenant
  /** Current persisted settings — seeds the form on mount. */
  settings?: Partial<TenantSettings>
  /** Called with the changed fields when the user clicks Save. */
  onSave?: (settings: Partial<TenantSettings>) => Promise<void>
  /** External saving flag merged with internal loading state. */
  isSaving?: boolean
  /** When false every input is disabled and Save is hidden. Defaults to true. */
  canEdit?: boolean
}

/* ─────────────────────────────────────────────
   Mock data (spec-exact)
───────────────────────────────────────────── */
const mockTenantSettings = {
  name: 'GridMind Capital Demo',
  slug: 'gridmind-demo',
  plan: 'enterprise',
  status: 'active',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  language: 'en',
  default_currency: 'USD',
  approval_threshold_low: 50000,
  approval_threshold_medium: 250000,
  approval_threshold_high: 1000000,
  auto_escalation_hours: 48,
  escalation_target: 'executive_sponsor',
  notifications_email: true,
  notifications_push: true,
  notifications_in_app: true,
  notifications_sms: false,
  sso_provider: 'local',
  mfa_required: false,
  session_timeout: '2 hours',
  max_concurrent_sessions: 5,
}

/* ─────────────────────────────────────────────
   Select option data
───────────────────────────────────────────── */
const TIMEZONES = [
  { value: 'UTC', label: 'UTC — Coordinated Universal Time' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
]

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-01-20)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (20/01/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (01/20/2026)' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY (20 Jan 2026)' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'hi', label: 'Hindi' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar', group: 'Major' },
  { value: 'EUR', label: 'EUR — Euro', group: 'Major' },
  { value: 'GBP', label: 'GBP — British Pound', group: 'Major' },
  { value: 'JPY', label: 'JPY — Japanese Yen', group: 'Major' },
  { value: 'CHF', label: 'CHF — Swiss Franc', group: 'Major' },
  { value: 'AUD', label: 'AUD — Australian Dollar', group: 'Major' },
  { value: 'CAD', label: 'CAD — Canadian Dollar', group: 'Major' },
  { value: 'SAR', label: 'SAR — Saudi Riyal', group: 'Middle East' },
  { value: 'AED', label: 'AED — UAE Dirham', group: 'Middle East' },
  { value: 'QAR', label: 'QAR — Qatari Riyal', group: 'Middle East' },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar', group: 'Middle East' },
  { value: 'BHD', label: 'BHD — Bahraini Dinar', group: 'Middle East' },
  { value: 'OMR', label: 'OMR — Omani Rial', group: 'Middle East' },
  { value: 'JOD', label: 'JOD — Jordanian Dinar', group: 'Middle East' },
  { value: 'EGP', label: 'EGP — Egyptian Pound', group: 'Africa' },
  { value: 'ZAR', label: 'ZAR — South African Rand', group: 'Africa' },
  { value: 'NGN', label: 'NGN — Nigerian Naira', group: 'Africa' },
  { value: 'KES', label: 'KES — Kenyan Shilling', group: 'Africa' },
  { value: 'MAD', label: 'MAD — Moroccan Dirham', group: 'Africa' },
  { value: 'BRL', label: 'BRL — Brazilian Real', group: 'Americas' },
  { value: 'MXN', label: 'MXN — Mexican Peso', group: 'Americas' },
  { value: 'CLP', label: 'CLP — Chilean Peso', group: 'Americas' },
  { value: 'COP', label: 'COP — Colombian Peso', group: 'Americas' },
  { value: 'ARS', label: 'ARS — Argentine Peso', group: 'Americas' },
  { value: 'PEN', label: 'PEN — Peruvian Sol', group: 'Americas' },
  { value: 'SEK', label: 'SEK — Swedish Krona', group: 'Europe' },
  { value: 'NOK', label: 'NOK — Norwegian Krone', group: 'Europe' },
  { value: 'DKK', label: 'DKK — Danish Krone', group: 'Europe' },
  { value: 'PLN', label: 'PLN — Polish Zloty', group: 'Europe' },
  { value: 'TRY', label: 'TRY — Turkish Lira', group: 'Europe' },
  { value: 'RUB', label: 'RUB — Russian Ruble', group: 'Europe' },
  { value: 'CNY', label: 'CNY — Chinese Yuan', group: 'Asia Pacific' },
  { value: 'INR', label: 'INR — Indian Rupee', group: 'Asia Pacific' },
  { value: 'KRW', label: 'KRW — South Korean Won', group: 'Asia Pacific' },
  { value: 'SGD', label: 'SGD — Singapore Dollar', group: 'Asia Pacific' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar', group: 'Asia Pacific' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit', group: 'Asia Pacific' },
  { value: 'THB', label: 'THB — Thai Baht', group: 'Asia Pacific' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah', group: 'Asia Pacific' },
  { value: 'PHP', label: 'PHP — Philippine Peso', group: 'Asia Pacific' },
  { value: 'VND', label: 'VND — Vietnamese Dong', group: 'Asia Pacific' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar', group: 'Asia Pacific' },
  { value: 'TWD', label: 'TWD — Taiwan Dollar', group: 'Asia Pacific' },
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'Fr',
  AUD: 'A$', CAD: 'C$', NZD: 'NZ$', SGD: 'S$', HKD: 'HK$',
  INR: '₹', KRW: '₩', BRL: 'R$', MXN: '$', RUB: '₽', TRY: '₺',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł',
  SAR: '﷼', AED: 'د.إ', KWD: 'KD', BHD: 'BD', OMR: 'OMR',
  QAR: 'QR', JOD: 'JD', EGP: 'E£', ZAR: 'R',
}

const SESSION_TIMEOUTS = [
  { value: '15 minutes', label: '15 minutes' },
  { value: '30 minutes', label: '30 minutes' },
  { value: '1 hour', label: '1 hour' },
  { value: '2 hours', label: '2 hours' },
  { value: '4 hours', label: '4 hours' },
  { value: '8 hours', label: '8 hours' },
  { value: '24 hours', label: '24 hours' },
]

const SSO_PROVIDERS = [
  { value: 'local', label: 'None (local auth only)' },
  { value: 'microsoft_entra', label: 'Microsoft Entra ID' },
  { value: 'google_workspace', label: 'Google Workspace' },
  { value: 'okta', label: 'Okta' },
  { value: 'auth0', label: 'Auth0' },
]

const ESCALATION_TARGETS = [
  { value: 'executive_sponsor', label: 'Executive Sponsor' },
  { value: 'pmo_director', label: 'PMO Director' },
  { value: 'tenant_admin', label: 'Tenant Admin' },
  { value: 'board', label: 'Board' },
]

const NOTIFICATION_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

/* ─────────────────────────────────────────────
   Form state
───────────────────────────────────────────── */
interface FormState {
  orgName: string
  timezone: string
  dateFormat: string
  language: string
  currency: string
  thresholdLow: string
  thresholdMedium: string
  thresholdHigh: string
  escalationHours: string
  escalationTarget: string
  notifyEmail: boolean
  notifyPush: boolean
  notifyInApp: boolean
  notifySms: boolean
  notifPriorities: Record<string, string>
  ssoProvider: string
  mfaRequired: boolean
  sessionTimeout: string
  maxSessions: string
}

const DEFAULT_FORM: FormState = {
  orgName: mockTenantSettings.name,
  timezone: mockTenantSettings.timezone,
  dateFormat: mockTenantSettings.date_format,
  language: mockTenantSettings.language,
  currency: mockTenantSettings.default_currency,
  thresholdLow: String(mockTenantSettings.approval_threshold_low),
  thresholdMedium: String(mockTenantSettings.approval_threshold_medium),
  thresholdHigh: String(mockTenantSettings.approval_threshold_high),
  escalationHours: String(mockTenantSettings.auto_escalation_hours),
  escalationTarget: mockTenantSettings.escalation_target,
  notifyEmail: mockTenantSettings.notifications_email,
  notifyPush: mockTenantSettings.notifications_push,
  notifyInApp: mockTenantSettings.notifications_in_app,
  notifySms: mockTenantSettings.notifications_sms,
  notifPriorities: {
    approval_requests: 'high',
    approval_decisions: 'normal',
    project_updates: 'normal',
    sla_warnings: 'high',
    escalations: 'urgent',
    system_alerts: 'low',
  },
  ssoProvider: 'local',
  mfaRequired: mockTenantSettings.mfa_required,
  sessionTimeout: '2 hours',
  maxSessions: String(mockTenantSettings.max_concurrent_sessions),
}

/* ─────────────────────────────────────────────
   Toggle Switch
───────────────────────────────────────────── */
function Toggle({
  checked,
  onChange,
  id,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a192f]',
        'disabled:pointer-events-none disabled:opacity-40',
        checked ? 'bg-[#0a192f]' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

/* ─────────────────────────────────────────────
   Sub-section header (inside a card)
───────────────────────────────────────────── */
function SubHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Section divider (with optional top-border spacing)
───────────────────────────────────────────── */
function SectionDivider({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <SubHeader title={title} description={description} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Field: label + input stacked
───────────────────────────────────────────── */
function Field({
  label,
  helper,
  htmlFor,
  required,
  children,
  error,
}: {
  label: string
  helper?: React.ReactNode
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : helper ? (
        <p className="text-xs text-slate-500">{helper}</p>
      ) : null}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Delete Confirmation Modal
──────────────��────────────────────────────── */
function DeleteModal({ onClose }: { onClose: () => void }) {
  const [confirmText, setConfirmText] = React.useState('')
  const [deleting, setDeleting] = React.useState(false)

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setDeleting(true)
    await new Promise(r => setTimeout(r, 1500))
    setDeleting(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="size-5 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="text-base font-semibold text-slate-900">
                Delete Account
              </h2>
              <p className="text-xs text-slate-500">This action cannot be undone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-medium text-red-800">Warning: This will permanently delete:</p>
            <ul className="mt-2 space-y-1 text-xs text-red-700 list-disc list-inside">
              <li>All projects, documents, and workflows</li>
              <li>All user accounts and permissions</li>
              <li>All financial data and audit trails</li>
              <li>All integrations and API keys</li>
            </ul>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-confirm" className="text-sm font-medium text-slate-700">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleting}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white',
              'hover:bg-red-700 transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {deleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Tab definitions
───────────────────────────────────────────── */
type Tab = 'general' | 'currency' | 'notifications' | 'security'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'currency', label: 'Currency & Thresholds', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
]

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function TenantSettingsPage({
  tenant,
  settings: externalSettings,
  onSave,
  isSaving: externalSaving = false,
  canEdit = true,
}: TenantSettingsProps = {}) {
  // Derive initial form from external settings when provided, fall back to mock
  const initialForm = React.useMemo<FormState>(() => {
    const s = externalSettings
    if (!s) return DEFAULT_FORM
    return {
      orgName:           s.name               ?? DEFAULT_FORM.orgName,
      timezone:          s.timezone           ?? DEFAULT_FORM.timezone,
      dateFormat:        s.date_format        ?? DEFAULT_FORM.dateFormat,
      language:          s.language           ?? DEFAULT_FORM.language,
      currency:          s.default_currency   ?? DEFAULT_FORM.currency,
      thresholdLow:      s.approval_threshold_low    != null ? String(s.approval_threshold_low)    : DEFAULT_FORM.thresholdLow,
      thresholdMedium:   s.approval_threshold_medium != null ? String(s.approval_threshold_medium) : DEFAULT_FORM.thresholdMedium,
      thresholdHigh:     s.approval_threshold_high   != null ? String(s.approval_threshold_high)   : DEFAULT_FORM.thresholdHigh,
      escalationHours:   s.auto_escalation_hours     != null ? String(s.auto_escalation_hours)     : DEFAULT_FORM.escalationHours,
      escalationTarget:  s.escalation_target  ?? DEFAULT_FORM.escalationTarget,
      notifyEmail:       s.notifications_email   ?? DEFAULT_FORM.notifyEmail,
      notifyPush:        s.notifications_push    ?? DEFAULT_FORM.notifyPush,
      notifyInApp:       s.notifications_in_app  ?? DEFAULT_FORM.notifyInApp,
      notifySms:         s.notifications_sms     ?? DEFAULT_FORM.notifySms,
      notifPriorities:   DEFAULT_FORM.notifPriorities,
      ssoProvider:       s.sso_provider      ?? DEFAULT_FORM.ssoProvider,
      mfaRequired:       s.mfa_required      ?? DEFAULT_FORM.mfaRequired,
      sessionTimeout:    s.session_timeout   ?? DEFAULT_FORM.sessionTimeout,
      maxSessions:       s.max_concurrent_sessions != null ? String(s.max_concurrent_sessions) : DEFAULT_FORM.maxSessions,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [activeTab, setActiveTab] = React.useState<Tab>('general')
  const [form, setForm] = React.useState<FormState>(initialForm)
  const [saving, setSaving] = React.useState(false)
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [orgNameError, setOrgNameError] = React.useState('')

  const isSaving = saving || externalSaving

  // Track unsaved changes against whichever baseline was used
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'orgName') {
      const v = value as string
      if (!v.trim()) setOrgNameError('Organization name is required')
      else if (v.trim().length < 2) setOrgNameError('Must be at least 2 characters')
      else setOrgNameError('')
    }
  }

  function handleDiscard() {
    setForm(initialForm)
    setOrgNameError('')
  }

  async function handleSave() {
    if (!form.orgName.trim()) {
      setOrgNameError('Organization name is required')
      setActiveTab('general')
      return
    }

    // Build the partial TenantSettings delta to pass to the caller
    const delta: Partial<TenantSettings> = {
      name:                       form.orgName,
      timezone:                   form.timezone,
      date_format:                form.dateFormat,
      language:                   form.language,
      default_currency:           form.currency,
      approval_threshold_low:     Number(form.thresholdLow),
      approval_threshold_medium:  Number(form.thresholdMedium),
      approval_threshold_high:    Number(form.thresholdHigh),
      auto_escalation_hours:      Number(form.escalationHours),
      escalation_target:          form.escalationTarget,
      notifications_email:        form.notifyEmail,
      notifications_push:         form.notifyPush,
      notifications_in_app:       form.notifyInApp,
      notifications_sms:          form.notifySms,
      email_priority:             form.notifPriorities['email'] ?? 'normal',
      push_priority:              form.notifPriorities['push'] ?? 'normal',
      in_app_priority:            form.notifPriorities['in_app'] ?? 'normal',
      sso_provider:               form.ssoProvider,
      mfa_required:               form.mfaRequired,
      session_timeout:            form.sessionTimeout,
      max_concurrent_sessions:    Number(form.maxSessions),
    }

    setSaving(true)
    try {
      if (onSave) {
        await onSave(delta)
      } else {
        await new Promise(r => setTimeout(r, 1200))
      }
    } finally {
      setSaving(false)
    }
  }

  const currencySymbol = CURRENCY_SYMBOLS[form.currency] ?? form.currency

  // Date format preview
  const DATE_PREVIEWS: Record<string, string> = {
    'YYYY-MM-DD': '2026-01-20',
    'DD/MM/YYYY': '20/01/2026',
    'MM/DD/YYYY': '01/20/2026',
    'DD MMM YYYY': '20 Jan 2026',
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">

          {/* Page header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tenant Settings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your organization configuration and platform preferences
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && isDirty && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700',
                    'hover:bg-slate-50 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <X className="size-4" aria-hidden="true" />
                  Discard
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg bg-[#0a192f] px-3 py-2 text-sm font-medium text-white',
                    'hover:bg-slate-800 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="size-4" aria-hidden="true" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
              {!canEdit && (
                <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400">
                  View only
                </span>
              )}
            </div>
          </div>

          {/* Unsaved changes indicator */}
          {isDirty && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-800">You have unsaved changes</p>
                <p className="text-xs text-amber-600">Save or discard before leaving</p>
              </div>
            </div>
          )}

          {/* Tab navigation */}
          <div className="mb-6 border-b border-slate-200">
            <nav className="flex gap-0" role="tablist" aria-label="Settings sections">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 pb-3 text-sm transition-colors',
                    activeTab === tab.id
                      ? 'border-b-2 border-[#0a192f] font-medium text-[#0a192f]'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  <tab.icon className="size-4" aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── TAB 1: General ── */}
          {activeTab === 'general' && (
            <div
              id="tabpanel-general"
              role="tabpanel"
              aria-label="General settings"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <SubHeader
                  title="Organization Information"
                  description="Basic details about your organization"
                />
                <div className="flex flex-col gap-4">
                  <Field
                    label="Organization Name"
                    htmlFor="org-name"
                    required
                    helper="This name appears across the platform"
                    error={orgNameError}
                  >
                    <input
                      id="org-name"
                      type="text"
                      value={form.orgName}
                      onChange={e => setField('orgName', e.target.value)}
                      placeholder="GridMind Capital Demo"
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition-colors',
                        'focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10',
                        orgNameError ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
                      )}
                    />
                  </Field>

                  <Field
                    label="Organization Slug"
                    htmlFor="org-slug"
                    helper="Used in URLs and API references"
                  >
                    <div className="relative">
                      <input
                        id="org-slug"
                        type="text"
                        value={tenant?.slug ?? (form.orgName ? form.orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : mockTenantSettings.slug)}
                        disabled
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-9 text-sm text-slate-500 outline-none"
                        aria-readonly="true"
                      />
                      <Lock className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    </div>
                  </Field>

                  <Field label="Current Plan" helper="">
                    <div className="flex items-center gap-2 py-1">
                      <span className="inline-flex items-center rounded-full bg-[#0a192f] px-3 py-1 text-xs font-medium text-white capitalize">
                        {tenant?.plan ?? 'Enterprise'}
                      </span>
                      <span className="text-xs text-slate-500">Contact support to upgrade or downgrade</span>
                      <a href="#" className="ml-1 text-xs text-sky-600 hover:underline">Upgrade</a>
                    </div>
                  </Field>

                  <Field label="Account Status" helper="Your account is in good standing">
                    <div className="flex items-center gap-2 py-1">
                      {(() => {
                        const status = tenant?.status ?? 'active'
                        const map: Record<string, string> = {
                          active:    'bg-green-100 text-green-700',
                          trial:     'bg-sky-100 text-sky-700',
                          suspended: 'bg-red-100 text-red-700',
                          churned:   'bg-slate-100 text-slate-500',
                        }
                        return (
                          <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize', map[status] ?? map.active)}>
                            {status}
                          </span>
                        )
                      })()}
                    </div>
                  </Field>
                </div>

                <SectionDivider
                  title="Regional Settings"
                />

                <div className="flex flex-col gap-4">
                  <Field
                    label="Timezone"
                    htmlFor="field-timezone"
                    helper="All dates and times displayed in this timezone"
                  >
                    <Select
                      id="field-timezone"
                      options={TIMEZONES}
                      value={form.timezone}
                      onValueChange={v => setField('timezone', v ?? 'UTC')}
                      placeholder="Select timezone"
                      fullWidth
                    />
                  </Field>

                  <Field
                    label="Date Format"
                    htmlFor="field-date-format"
                    helper={`Preview: ${DATE_PREVIEWS[form.dateFormat] ?? '2026-01-20'}`}
                  >
                    <Select
                      id="field-date-format"
                      options={DATE_FORMATS}
                      value={form.dateFormat}
                      onValueChange={v => setField('dateFormat', v ?? 'YYYY-MM-DD')}
                      placeholder="Select date format"
                      fullWidth
                    />
                  </Field>

                  <Field
                    label="Language"
                    htmlFor="field-language"
                    helper="Interface language"
                  >
                    <Select
                      id="field-language"
                      options={LANGUAGES}
                      value={form.language}
                      onValueChange={v => setField('language', v ?? 'en')}
                      placeholder="Select language"
                      fullWidth
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: Currency & Thresholds ── */}
          {activeTab === 'currency' && (
            <div id="tabpanel-currency" role="tabpanel" aria-label="Currency and threshold settings">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <SubHeader
                  title="Default Currency"
                  description="Base currency for all financial calculations"
                />
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Field label="Base Currency" htmlFor="field-currency" helper="All financial reports will use this currency">
                      <Select
                        id="field-currency"
                        options={CURRENCIES}
                        value={form.currency}
                        onValueChange={v => setField('currency', v ?? 'USD')}
                        placeholder="Select currency"
                        fullWidth
                      />
                    </Field>
                  </div>
                  <div className="mt-5 text-3xl font-light text-slate-300 select-none" aria-hidden="true">
                    {currencySymbol}
                  </div>
                </div>

                <SectionDivider
                  title="Approval Thresholds"
                  description="Define monetary thresholds for automatic approval routing"
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Low */}
                  <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Low</span>
                      <ArrowDown className="size-4 text-green-500" aria-hidden="true" />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={form.thresholdLow}
                        onChange={e => setField('thresholdLow', e.target.value)}
                        placeholder="50000"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10"
                        aria-label="Low threshold amount"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">Up to this amount</p>
                    <p className="mt-1 text-xs text-slate-600">Approver: Project Manager</p>
                  </div>

                  {/* Medium */}
                  <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Medium</span>
                      <ArrowRight className="size-4 text-amber-500" aria-hidden="true" />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={form.thresholdMedium}
                        onChange={e => setField('thresholdMedium', e.target.value)}
                        placeholder="250000"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10"
                        aria-label="Medium threshold amount"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">Between Low and High</p>
                    <p className="mt-1 text-xs text-slate-600">Approver: PMO Director</p>
                  </div>

                  {/* High */}
                  <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">High</span>
                      <ArrowUp className="size-4 text-red-500" aria-hidden="true" />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={form.thresholdHigh}
                        onChange={e => setField('thresholdHigh', e.target.value)}
                        placeholder="1000000"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10"
                        aria-label="High threshold amount"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">Above this amount</p>
                    <p className="mt-1 text-xs text-slate-600">Approver: Executive Sponsor</p>
                  </div>
                </div>

                {/* Board approval note */}
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <Info className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <p className="text-sm text-slate-600">
                    Amounts above High threshold require Board approval.{' '}
                    <a href="#" className="text-sky-600 hover:underline">Configure in Approval Rules</a>
                  </p>
                </div>

                <SectionDivider title="Auto-Escalation" />

                <div className="flex flex-col gap-4">
                  <Field
                    label="Auto-Escalation After"
                    htmlFor="field-esc-hours"
                    helper="Approvals pending longer than this will auto-escalate (1–168 hours)"
                  >
                    <div className="relative">
                      <input
                        id="field-esc-hours"
                        type="number"
                        min={1}
                        max={168}
                        value={form.escalationHours}
                        onChange={e => setField('escalationHours', e.target.value)}
                        placeholder="48"
                        className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-14 text-sm outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        hours
                      </span>
                    </div>
                  </Field>

                  <Field
                    label="Escalate To"
                    htmlFor="field-esc-target"
                    helper="Role that receives escalated approvals"
                  >
                    <Select
                      id="field-esc-target"
                      options={ESCALATION_TARGETS}
                      value={form.escalationTarget}
                      onValueChange={v => setField('escalationTarget', v ?? 'executive_sponsor')}
                      placeholder="Select escalation target"
                      fullWidth
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: Notifications ── */}
          {activeTab === 'notifications' && (
            <div id="tabpanel-notifications" role="tabpanel" aria-label="Notification settings">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <SubHeader title="Notification Channels" />

                <div className="flex flex-col gap-0 divide-y divide-slate-100">
                  {[
                    {
                      key: 'notifyEmail' as const,
                      icon: Mail,
                      label: 'Email Notifications',
                      desc: 'Receive updates via email',
                      enterprise: false,
                    },
                    {
                      key: 'notifyPush' as const,
                      icon: Bell,
                      label: 'Push Notifications',
                      desc: 'Browser push notifications',
                      enterprise: false,
                    },
                    {
                      key: 'notifyInApp' as const,
                      icon: Monitor,
                      label: 'In-App Notifications',
                      desc: 'Notification center in platform',
                      enterprise: false,
                    },
                    {
                      key: 'notifySms' as const,
                      icon: Smartphone,
                      label: 'SMS Notifications',
                      desc: 'Critical alerts via SMS',
                      enterprise: true,
                    },
                  ].map(({ key, icon: Icon, label, desc, enterprise }) => (
                    <div key={key} className="flex items-center justify-between gap-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Icon className="size-4 text-slate-500" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <label htmlFor={`toggle-${key}`} className="cursor-pointer text-sm font-medium text-slate-700">
                              {label}
                            </label>
                            {enterprise && (
                              <span className="inline-flex items-center rounded-full bg-[#0a192f] px-2 py-0.5 text-[10px] font-medium text-white">
                                Enterprise
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{desc}</p>
                        </div>
                      </div>
                      <Toggle
                        id={`toggle-${key}`}
                        checked={form[key]}
                        onChange={v => setField(key, v)}
                      />
                    </div>
                  ))}
                </div>

                <SectionDivider title="Notification Preferences" />

                <div className="flex flex-col gap-3">
                  {[
                    { id: 'approval_requests', label: 'Approval Requests', desc: 'When someone requests your approval' },
                    { id: 'approval_decisions', label: 'Approval Decisions', desc: 'When your approval is decided' },
                    { id: 'project_updates', label: 'Project Updates', desc: 'When project status changes' },
                    { id: 'sla_warnings', label: 'SLA Warnings', desc: 'When approvals are nearing deadline' },
                    { id: 'escalations', label: 'Escalations', desc: 'When approvals are escalated' },
                    { id: 'system_alerts', label: 'System Alerts', desc: 'Platform maintenance and updates' },
                  ].map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <Select
                        options={NOTIFICATION_PRIORITIES}
                        value={form.notifPriorities[item.id]}
                        onValueChange={v =>
                          setField('notifPriorities', {
                            ...form.notifPriorities,
                            [item.id]: v ?? 'normal',
                          })
                        }
                        placeholder="Priority"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: Security ── */}
          {activeTab === 'security' && (
            <div id="tabpanel-security" role="tabpanel" aria-label="Security settings">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <SubHeader title="Authentication" />

                <div className="flex flex-col gap-4">
                  <Field label="Single Sign-On" htmlFor="field-sso" helper="External identity provider">
                    <Select
                      id="field-sso"
                      options={SSO_PROVIDERS}
                      value={form.ssoProvider}
                      onValueChange={v => setField('ssoProvider', v ?? 'none')}
                      placeholder="Select SSO provider"
                      fullWidth
                    />
                  </Field>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                        <Shield className="size-4 text-slate-500" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="toggle-mfa" className="cursor-pointer text-sm font-medium text-slate-700">
                            Require MFA
                          </label>
                          <span className="inline-flex items-center rounded-full bg-[#0a192f] px-2 py-0.5 text-[10px] font-medium text-white">
                            Enterprise
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Enforce multi-factor authentication</p>
                      </div>
                    </div>
                    <Toggle
                      id="toggle-mfa"
                      checked={form.mfaRequired}
                      onChange={v => setField('mfaRequired', v)}
                    />
                  </div>
                </div>

                <SectionDivider title="Session Management" />

                <div className="flex flex-col gap-4">
                  <Field
                    label="Session Timeout"
                    htmlFor="field-session-timeout"
                    helper="Inactive users will be logged out after this period"
                  >
                    <Select
                      id="field-session-timeout"
                      options={SESSION_TIMEOUTS}
                      value={form.sessionTimeout}
                      onValueChange={v => setField('sessionTimeout', v ?? '2 hours')}
                      placeholder="Select timeout"
                      fullWidth
                    />
                  </Field>

                  <Field
                    label="Max Concurrent Sessions"
                    htmlFor="field-max-sessions"
                    helper="Maximum active sessions per user"
                  >
                    <input
                      id="field-max-sessions"
                      type="number"
                      min={1}
                      max={50}
                      value={form.maxSessions}
                      onChange={e => setField('maxSessions', e.target.value)}
                      placeholder="5"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 md:w-32"
                    />
                  </Field>
                </div>

                {/* Danger Zone */}
                <div className="mt-8 border-t border-red-100 pt-6">
                  <h3 className="mb-4 text-lg font-semibold text-red-600">Danger Zone</h3>
                  <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <AlertTriangle className="size-5 shrink-0 text-red-500" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-red-800">These actions are irreversible</p>
                      <p className="text-xs text-red-600">Proceed with caution</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Download className="size-4" aria-hidden="true" />
                        Export All Data
                      </button>
                      <p className="mt-1 text-xs text-slate-500">Download all tenant data as JSON</p>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                      >
                        <Pause className="size-4" aria-hidden="true" />
                        Suspend Account
                      </button>
                      <p className="mt-1 text-xs text-slate-500">Temporarily disable all access</p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Delete Account
                      </button>
                      <p className="mt-1 text-xs text-slate-500">Permanently delete all data</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteModal onClose={() => setShowDeleteModal(false)} />
      )}
    </>
  )
}
