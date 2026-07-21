'use client'

import * as React from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { AdminConsole } from '@/components/admin/admin-console'
import { getUsers, updateUserRole } from '@/app/actions/admin'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'

export default function AdminConsolePage() {
  const { data: rawUsers, isLoading, mutate } = useSWR('admin-users', getUsers)

  const DB_ROLE_MAP: Record<string, UserRole> = {
    system_admin:    'super_admin',
    tenant_admin:    'tenant_admin',
    admin:           'tenant_admin',
    project_manager: 'project_manager',
    pmo_director:    'pmo_director',
    viewer:          'viewer',
    member:          'viewer',
  }

  function toComponentRole(dbRole: string | null | undefined): UserRole {
    if (!dbRole) return 'viewer'
    return DB_ROLE_MAP[dbRole] ?? 'viewer'
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
    await updateUserRole(userId, role)
    mutate()
  }

  return (
    <AdminConsole
      users={isLoading ? [] : users}
      totalCount={users.length}
      isLoading={isLoading}
      onUpdateRole={handleUpdateRole}
    />
  )
}
