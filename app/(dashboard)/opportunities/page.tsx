import type { Metadata } from 'next'
import { OpportunitiesPage } from '@/components/opportunities/opportunities-page'

export const metadata: Metadata = { title: 'Opportunities' }

export default function Page() {
  return <OpportunitiesPage />
}
