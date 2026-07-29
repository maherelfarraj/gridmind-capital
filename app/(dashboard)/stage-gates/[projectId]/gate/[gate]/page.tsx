/**
 * /stage-gates/[projectId]/gate/[gate]
 * Renders the canonical Gate 1–8 workflow forms for the given project.
 * BATCH 20: Unified around 1-8 phase model (legacy 0-7 rows archived, read-only).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { G0IntakeForm } from '@/components/stage-gate/g0-intake-form'
import { G1DevelopmentForm } from '@/components/stage-gate/g1-development-form'
import { G2EngineeringForm } from '@/components/stage-gate/g2-engineering-form'
import { G3ProcurementForm } from '@/components/stage-gate/g3-procurement-form'
import { G4ConstructionForm } from '@/components/stage-gate/g4-construction-form'
import { G6CommissioningForm } from '@/components/stage-gate/g6-commissioning-form'
import { G7HandoverForm } from '@/components/stage-gate/g7-handover-form'
import { LockedInfoPanel } from '@/components/stage-gate/locked-info-panel'

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

  // Accept canonical 1-8 gate numbers; 0 reserved for legacy/demo only
  if (isNaN(gateNum) || gateNum < 0 || gateNum > 8) notFound()

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
    // BATCH 20 CORRECTED: Semantic 1-8 canonical phase mapping
    // Gates 2 & 3 are locked info panels (no workspace form yet)
    switch (gateNum) {
      case 0:
        // Legacy G0 (Opportunity Intake)
        return <G0IntakeForm {...shared} initialData={initialData} />
      case 1:
        // G1: Origination & Feasibility (uses G1DevelopmentForm)
        return <G1DevelopmentForm {...shared} initialData={initialData} />
      case 2:
        // G2: Permitting & Grid Application (no workspace form yet)
        return <LockedInfoPanel phase={2} title="Permitting & Grid Application" description="Grid connection application and permitting phase — form workspace not yet available." />
      case 3:
        // G3: Commercial & Financial Close (RTB) (no workspace form yet)
        return <LockedInfoPanel phase={3} title="Commercial & Financial Close (RTB)" description="Final commercial terms and ready-to-build approval — form workspace not yet available." />
      case 4:
        // G4: Detailed Design (IFC) (uses G2EngineeringForm)
        return <G2EngineeringForm {...shared} initialData={initialData} />
      case 5:
        // G5: Procurement & Manufacturing (uses G3ProcurementForm)
        return <G3ProcurementForm {...shared} initialData={initialData} />
      case 6:
        // G6: Construction & Installation (uses G4ConstructionForm)
        return <G4ConstructionForm {...shared} initialData={initialData} />
      case 7:
        // G7: Commissioning & Grid Tests (uses G6CommissioningForm)
        return <G6CommissioningForm {...shared} initialData={initialData} />
      case 8:
        // G8: Handover & O&M (uses G7HandoverForm)
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
