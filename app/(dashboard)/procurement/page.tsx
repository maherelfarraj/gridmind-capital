import type { Metadata } from 'next'
import { ProcurementPage } from '@/components/procurement/procurement-page'

export const metadata: Metadata = { title: 'Procurement' }

export default function Page() {
  return <ProcurementPage />
}
