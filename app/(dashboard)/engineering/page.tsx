import type { Metadata } from 'next'
import { EngineeringPage } from '@/components/engineering/engineering-page'

export const metadata: Metadata = { title: 'Engineering' }

export default function Page() {
  return <EngineeringPage />
}
