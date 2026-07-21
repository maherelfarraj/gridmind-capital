'use server'

import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/components/projects/projects-list-page'

const PHASE_MAP: Record<number, string> = {
  0: 'intake', 1: 'commercial', 2: 'engineering', 3: 'engineering',
  4: 'procurement', 5: 'construction', 6: 'commissioning', 7: 'om', 8: 'finance',
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id, code, name, status, technology, budget_usd, current_phase, target_completion, location, country')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client_name: p.location ?? p.country ?? '—',
    phase: PHASE_MAP[p.current_phase ?? 0] ?? 'intake',
    gate: `G${p.current_phase ?? 0}`,
    budget_amount: p.budget_usd ?? 0,
    status: (p.status as Project['status']) ?? 'active',
    target_cod: p.target_completion ?? '',
  }))
}
