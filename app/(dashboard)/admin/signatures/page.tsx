import { Metadata } from 'next'
import { SignatureAudit } from '@/components/admin/signature-audit'

export const metadata: Metadata = {
  title: 'Signature Audit — GridMind Capital',
  description: 'Tenant-wide electronic signature audit trail for governance and compliance.',
}

export default function SignatureAuditPage() {
  return (
    <main className="flex flex-col h-full p-6">
      <SignatureAudit />
    </main>
  )
}
