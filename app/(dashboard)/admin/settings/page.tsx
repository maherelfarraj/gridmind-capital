import { ToastProvider } from '@/components/ui/toast'
import { TenantSettingsPage } from '@/components/settings/tenant-settings-page'

export const metadata = { title: 'Tenant Settings — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <TenantSettingsPage />
    </ToastProvider>
  )
}
