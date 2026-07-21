'use client'

import useSWR from 'swr'
import { TenantSettingsPage } from '@/components/settings/tenant-settings-page'
import { getTenant, updateTenant } from '@/app/actions/admin'
import type { TenantSettings } from '@/components/settings/tenant-settings-page'

export default function Page() {
  const { data: tenant, isLoading } = useSWR('admin-tenant', getTenant)

  const handleSave = async (settings: Partial<TenantSettings>) => {
    await updateTenant({
      name: settings.name,
      settings: {
        timezone: settings.timezone,
        date_format: settings.date_format,
        language: settings.language,
        default_currency: settings.default_currency,
        approval_threshold_low: settings.approval_threshold_low,
        approval_threshold_medium: settings.approval_threshold_medium,
        approval_threshold_high: settings.approval_threshold_high,
        auto_escalation_hours: settings.auto_escalation_hours,
        escalation_target: settings.escalation_target,
        notifications_email: settings.notifications_email,
        notifications_push: settings.notifications_push,
        notifications_in_app: settings.notifications_in_app,
        notifications_sms: settings.notifications_sms,
        mfa_required: settings.mfa_required,
        session_timeout: settings.session_timeout,
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <TenantSettingsPage
      tenant={tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status as 'active' | 'suspended' | 'trial' | 'churned',
        created_at: tenant.created_at,
      } : undefined}
      settings={tenant?.settings as Partial<TenantSettings> | undefined}
      onSave={handleSave}
      canEdit
    />
  )
}
