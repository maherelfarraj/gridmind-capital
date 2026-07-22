import { TenantSettingsPage } from '@/components/settings/tenant-settings-page'
import { SendTestDigestCard } from '@/components/admin/send-test-digest-card'

export const metadata = { title: 'Tenant Settings — GridMind Capital' }

export default function Page() {
  return (
    <div className="space-y-6">
      <SendTestDigestCard />
      <TenantSettingsPage />
    </div>
  )
}
