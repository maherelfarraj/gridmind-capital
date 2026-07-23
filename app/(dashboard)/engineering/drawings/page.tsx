import type { Metadata } from 'next'
import { EngineeringCockpit } from '@/components/engineering/engineering-cockpit'

export const metadata: Metadata = { title: 'Drawing Register — GridMind Capital' }

export default function Page() {
  return <EngineeringCockpit initialTab="drawings" />
}
