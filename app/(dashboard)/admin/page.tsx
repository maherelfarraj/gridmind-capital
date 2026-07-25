'use client'

import * as React from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { AdminConsole } from '@/components/admin/admin-console'
import { PlatformHealthCard } from '@/components/admin/platform-health-card'
import { getUsers, updateUserRole } from '@/app/actions/admin'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'
import { isDbUserRole } from '@/lib/auth/roles'

export default function AdminConsolePage() {
  const { data: rawUsers, isLoading, mutate } = useSWR('admin-users', getUsers)

  // The users screen now speaks the database `user_role` vocabulary directly,
  // so no translation is needed. The previous map collapsed engineer /
  // hse_manager / finance_manager / commissioning_manager / commercial_manager /
  // project_director all to 'viewer', mislabelling those users and letting a
  // role edit silently downgrade them.
  function toComponentRole(dbRole: string | null | undefined): UserRole {
    return isDbUserRole(dbRole) ? dbRole : 'viewer'
  }

  function toRelativeTime(iso: string | null | undefined): string {
    if (!iso) return 'Never'
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }) }
    catch { return 'Unknown' }
  }

  const users: UserProfile[] = React.useMemo(() => (rawUsers ?? []).map((u) => ({
    id:         u.id,
    name:       u.full_name,
    email:      u.email,
    role:       toComponentRole(u.role),
    department: u.department ?? '—',
    status:     (u.department === 'Deactivated' ? 'inactive' : 'active') as 'active' | 'inactive',
    lastActive: toRelativeTime(u.last_seen_at),
    joinedAt:   u.created_at?.split('T')[0] ?? '',
  })), [rawUsers])

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    const res = await updateUserRole(userId, role)
    // The action returns { error } rather than throwing; ignoring it made a
    // rejected write look successful until the next refetch reverted the row.
    if (res?.error) throw new Error(res.error)
    mutate()
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PlatformHealthCard />
      <AdminConsole
        users={isLoading ? [] : users}
        totalCount={users.length}
        isLoading={isLoading}
        onUpdateRole={handleUpdateRole}
      />
    </div>
  )
}
