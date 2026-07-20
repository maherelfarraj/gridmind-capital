import { ToastProvider } from '@/components/ui/toast'
import { UsersRolesPage } from '@/components/admin/users-roles-page'

export const metadata = { title: 'Users & Roles — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <UsersRolesPage />
    </ToastProvider>
  )
}
