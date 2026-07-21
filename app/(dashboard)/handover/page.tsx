import type { Metadata } from 'next'
import { HandoverPage } from '@/components/handover/handover-page'

export const metadata: Metadata = {
  title: 'Project Handover | GridMind Capital',
  description: 'Track and accept project handover items across technical, commercial, safety, documentation and training categories.',
}

export default function Page() {
  return <HandoverPage />
}
