'use client'

import * as React from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { UsersRolesPage } from '@/components/admin/users-roles-page'
import { getUsers, updateUserRole } from '@/app/actions/admin'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'

// Map DB role strings → component UserRole union
const DB_ROLE_MAP: Record<string, UserRole> = {
  system_admin:   'super_admin',
  tenant_admin:   'tenant_admin',
  admin:          'tenant_admin',
  project_manager:'project_manager',
  pmo_director:   'pmo_director',
  viewer:         'viewer',
  member:         'viewer',
}

function toComponentRole(dbRole: string | null | undefined): UserRole {
  if (!dbRole) return 'viewer'
  return DB_ROLE_MAP[dbRole] ?? 'viewer'
}

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
  const users: UserProfile[] = React.useMemo(() => (rawUsers ?? []).map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: toComponentRole(u.role),
    department: u.department ?? '—',
    status: (u.department === 'Deactivated' ? 'inactive' : 'active') as 'active' | 'inactive',
    lastActive: toRelativeTime(u.last_seen_at),
    joinedAt: u.created_at?.split('T')[0] ?? '',
  })), [rawUsers])

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role)
    mutate()
  }

  // Wait for data before rendering so the component initialises with real rows
  if (isLoading || !rawUsers) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading users...
      </div>
    )
  }

  return (
    <UsersRolesPage
      users={users}
      totalCount={users.length}
      isLoading={false}
      onUpdateRole={handleUpdateRole}
    />
  )
}
