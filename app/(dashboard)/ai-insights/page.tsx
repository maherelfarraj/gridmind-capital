import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AiInsightsPage } from '@/components/ai/ai-insights-page'

export const metadata: Metadata = { title: 'AI Insights' }

export default async function Page() {
  return <Suspense><AiInsightsPage /></Suspense>
}
