import { Metadata } from 'next'
import { AuditLogViewer } from '@/components/admin/audit-log-viewer'

export const metadata: Metadata = {
  title: 'Audit Log — GridMind Capital',
  description: 'Row-level change history for audited tables — inserts, updates, and deletes written by database triggers.',
}

export default function AuditPage() {
  return (
    <main className="flex flex-col h-full p-6">
      <AuditLogViewer />
    </main>
  )
}
