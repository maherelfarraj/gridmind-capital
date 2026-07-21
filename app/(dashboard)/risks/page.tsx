import type { Metadata } from 'next'
import { RisksPage } from '@/components/risks/risks-page'

export const metadata: Metadata = { title: 'Risk Register' }

export default function Page() {
  return <RisksPage />
}
