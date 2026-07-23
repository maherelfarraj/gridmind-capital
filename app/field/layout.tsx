import type { Metadata } from 'next'
import { FieldShell } from '@/components/field/field-shell'

export const metadata: Metadata = {
  title: 'Field Mode',
  description: 'Mobile field reporting — daily reports, punch items and site photos.',
}

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return <FieldShell>{children}</FieldShell>
}
