'use server'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { FinanceEvmPage } from '@/components/finance/finance-evm-page'

export const metadata: Metadata = { title: 'Finance — EVM' }

export default async function Page() {
  return <Suspense><FinanceEvmPage /></Suspense>
}
