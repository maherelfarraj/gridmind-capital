/**
 * /stage-gates/[projectId]/gate/[gate]
 * Renders the G0–G7 workflow form for the given project.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { G0IntakeForm } from '@/components/stage-gate/g0-intake-form'
import { G1DevelopmentForm } from '@/components/stage-gate/g1-development-form'
import { G2EngineeringForm } from '@/components/stage-gate/g2-engineering-form'
import { G3ProcurementForm } from '@/components/stage-gate/g3-procurement-form'
import { G4ConstructionForm } from '@/components/stage-gate/g4-construction-form'
import { G5MechanicalCompletionForm } from '@/components/stage-gate/g5-mechanical-completion-form'
import { G6CommissioningForm } from '@/components/stage-gate/g6-commissioning-form'
import { G7HandoverForm } from '@/components/stage-gate/g7-handover-form'

interface Props {
  params: Promise<{ projectId: string; gate: string }>
}

export async function generateMetadata({ params }: Props) {
  const { gate } = await params
  return { title: `Gate ${gate} Form — GridMind Capital` }
}

export default async function GateFormPage({ params }: Props) {
  const { projectId, gate } = await params
  const gateNum = parseInt(gate, 10)

  if (isNaN(gateNum) || gateNum < 0 || gateNum > 7) notFound()

  const supabase = createAdminClient()

  // Fetch project
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, code, name')
    .eq('id', projectId)
    .single()

  if (error || !project) notFound()

  // Fetch any existing submission for this gate
  const { data: existing } = await supabase
    .from('gate_submissions')
    .select('form_data, status')
    .eq('project_id', projectId)
    .eq('gate_number', gateNum)
    .maybeSingle()

  const isReadOnly = existing?.status === 'approved'
  const initialData = (existing?.form_data ?? undefined) as Record<string, unknown> | undefined

  const shared = {
    projectId:   project.id,
    projectCode: project.code,
    projectName: project.name,
    readOnly:    isReadOnly,
  }

  function renderForm() {
    switch (gateNum) {
      case 0:
        return <G0IntakeForm {...shared} initialData={initialData} />
      case 1:
        return <G1DevelopmentForm {...shared} initialData={initialData} />
      case 2:
        return <G2EngineeringForm {...shared} initialData={initialData} />
      case 3:
        return <G3ProcurementForm {...shared} initialData={initialData} />
      case 4:
        return <G4ConstructionForm {...shared} initialData={initialData} />
      case 5:
        return <G5MechanicalCompletionForm {...shared} initialData={initialData} />
      case 6:
        return <G6CommissioningForm {...shared} initialData={initialData} />
      case 7:
        return <G7HandoverForm {...shared} initialData={initialData} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {renderForm()}
    </div>
  )
}
