import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ConstructionPage } from '@/components/construction/construction-page'

export const metadata: Metadata = { title: 'Construction' }

export default async function Page() {
  return (
    <Suspense>
      <ConstructionPage />
    </Suspense>
  )
}
