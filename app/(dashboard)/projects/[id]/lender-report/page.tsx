import { LenderReportClient } from '@/components/lender/lender-report-client'

export default async function LenderReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LenderReportClient projectId={id} />
}
