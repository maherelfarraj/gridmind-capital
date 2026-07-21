'use client'

import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { UsersRolesPage } from '@/components/admin/users-roles-page'
import { getUsers, updateUserRole } from '@/app/actions/admin'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'

function toRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

export default function Page() {
  const { data: rawUsers, isLoading, mutate } = useSWR('admin-users', getUsers)

  // Map DB profile shape → UsersRolesPage UserProfile shape
  const users: UserProfile[] = (rawUsers ?? []).map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: (u.role as UserRole) ?? 'viewer',
    department: u.department ?? '—',
    status: (u.department === 'Deactivated' ? 'inactive' : 'active') as 'active' | 'inactive',
    lastActive: toRelativeTime(u.last_seen_at),
    joinedAt: u.created_at?.split('T')[0] ?? '',
  }))

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role)
    mutate()
  }

  return (
    <UsersRolesPage
      users={users}
      totalCount={users.length}
      isLoading={isLoading}
      onUpdateRole={handleUpdateRole}
    />
  )
}
