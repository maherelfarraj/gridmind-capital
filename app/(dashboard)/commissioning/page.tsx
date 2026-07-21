import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CommissioningPage } from '@/components/commissioning/commissioning-page'

export const metadata: Metadata = { title: 'Commissioning' }

export default async function Page() {
  return (
    <Suspense>
      <CommissioningPage />
    </Suspense>
  )
}
