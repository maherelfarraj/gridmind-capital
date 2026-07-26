/**
 * GET /api/setup/gate-submissions
 * Creates gate_submissions table for G0/G1 workflow forms.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const secret = process.env.SETUP_SECRET
  if (!secret || request.headers.get('x-setup-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Check if table already exists
  const { error: checkError } = await supabase.from('gate_submissions').select('id').limit(1)
  if (!checkError) {
    return NextResponse.json({ ok: true, message: 'gate_submissions table already exists.' })
  }

  return NextResponse.json({
    ok: false,
    message: 'Run the following SQL in your Supabase SQL Editor to create the gate_submissions table.',
    sql: `
CREATE TABLE IF NOT EXISTS gate_submissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate_number  integer     NOT NULL CHECK (gate_number BETWEEN 0 AND 6),
  form_data    jsonb       NOT NULL DEFAULT '{}',
  status       text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','approved','rejected')),
  submitted_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, gate_number)
);

CREATE INDEX IF NOT EXISTS idx_gate_submissions_project
  ON gate_submissions(project_id);
    `.trim(),
  }, { status: 412 })
}
