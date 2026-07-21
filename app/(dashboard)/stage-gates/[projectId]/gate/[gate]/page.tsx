/**
 * /stage-gates/[projectId]/gate/[gate]
 * Renders the G0 or G1 workflow form for the given project.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { G0IntakeForm } from '@/components/stage-gate/g0-intake-form'
import { G1DevelopmentForm } from '@/components/stage-gate/g1-development-form'

interface Props {
  params: Promise<{ projectId: string; gate: string }>
}

export async function generateMetadata({ params }: Props) {
  const { gate, projectId } = await params
  return { title: `Gate ${gate} Form — GridMind Capital` }
}

export default async function GateFormPage({ params }: Props) {
  const { projectId, gate } = await params
  const gateNum = parseInt(gate, 10)

  if (isNaN(gateNum) || gateNum > 1) notFound()

  const supabase = createAdminClient()

  // Fetch project
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, code, name')
    .eq('id', projectId)
    .single()

  if (error || !project) notFound()

  // Fetch any existing submission
  const { data: existing } = await supabase
    .from('gate_submissions')
    .select('form_data, status')
    .eq('project_id', projectId)
    .eq('gate_number', gateNum)
    .maybeSingle()

  const isReadOnly = existing?.status === 'approved'

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {gateNum === 0 ? (
        <G0IntakeForm
          projectId={project.id}
          projectCode={project.code}
          projectName={project.name}
          initialData={existing?.form_data ?? undefined}
          readOnly={isReadOnly}
        />
      ) : (
        <G1DevelopmentForm
          projectId={project.id}
          projectCode={project.code}
          projectName={project.name}
          initialData={existing?.form_data ?? undefined}
          readOnly={isReadOnly}
        />
      )}
    </div>
  )
}
