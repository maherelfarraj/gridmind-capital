import type { Metadata } from 'next'
import { DevPortal } from '@/components/dev-portal/dev-portal'

export const metadata: Metadata = {
  title: 'API Reference — GridMind Capital',
  description: 'Developer documentation for the GridMind Capital API. REST endpoints, authentication, SDKs, and webhooks.',
}

// Full-bleed page — bypasses AppShell layout
export default function ApiDocsPage() {
  return <DevPortal />
}
