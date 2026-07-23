import type { Metadata } from 'next'
import { EngineeringCockpit } from '@/components/engineering/engineering-cockpit'

export const metadata: Metadata = { title: 'IFC Packages — GridMind Capital' }

export default function Page() {
  return <EngineeringCockpit initialTab="packages" />
}
