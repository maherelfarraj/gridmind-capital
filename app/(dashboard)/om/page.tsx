'use server'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { OmPage } from '@/components/om/om-page'

export const metadata: Metadata = { title: 'O&M' }

export default async function Page() {
  return <Suspense><OmPage /></Suspense>
}
