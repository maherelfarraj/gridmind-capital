import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { UsersRolesPage } from '@/components/admin/users-roles-page'

export default function Home() {
  return (
    <AppShell
      title="Users & Roles"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Users & Roles' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <UsersRolesPage />
      </ToastProvider>
    </AppShell>
  )
}
