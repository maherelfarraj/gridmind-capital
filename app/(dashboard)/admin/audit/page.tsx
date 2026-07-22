import { Metadata } from 'next'
import { AuditTrail } from '@/components/notifications/audit-trail'

export const metadata: Metadata = {
  title: 'Audit Trail — GridMind Capital',
  description: 'Immutable workflow event log for governance and compliance.',
}

export default function AuditPage() {
  return (
    <main className="flex flex-col h-full p-6">
      <AuditTrail />
    </main>
  )
}
