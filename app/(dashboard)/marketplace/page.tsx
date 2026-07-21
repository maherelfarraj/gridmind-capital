import { Suspense } from 'react'
import type { Metadata } from 'next'
import { MarketplacePage } from '@/components/marketplace/marketplace-page'

export const metadata: Metadata = {
  title: 'Marketplace | GREOS',
  description: 'Provider directory, integration hub and data exchange log',
}

export default function Page() {
  return (
    <Suspense>
      <MarketplacePage />
    </Suspense>
  )
}
