import type { Metadata } from 'next'
import { ProcurementCockpit } from '@/components/procurement/procurement-cockpit'

export const metadata: Metadata = { title: 'Procurement — GridMind Capital' }

export default function Page() {
  return <ProcurementCockpit />
}
