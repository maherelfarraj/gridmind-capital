import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/setup/sprint-s08-s23-tables
 * Creates the missing tables for sprints S08–S23.
 * Idempotent — uses IF NOT EXISTS throughout.
 */
export async function GET() {
  const sb = createAdminClient()

  const ddl = `
    -- S08: Opportunities
    CREATE TABLE IF NOT EXISTS opportunities (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     uuid NOT NULL,
      name          text NOT NULL,
      code          text,
      technology    text,
      capacity_mw   numeric,
      location      text,
      country       text,
      stage         text CHECK (stage IN ('prospect','screening','feasibility','approved','rejected')) DEFAULT 'prospect',
      irr_pct       numeric,
      capex_usd     numeric,
      description   text,
      created_by    uuid,
      created_at    timestamptz DEFAULT now()
    );

    -- S18: Handover records
    CREATE TABLE IF NOT EXISTS handover_records (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       uuid NOT NULL,
      project_id      uuid,
      document_type   text CHECK (document_type IN ('as_built','operation_manual','warranty','training_cert','spare_parts')),
      title           text NOT NULL,
      revision        text DEFAULT 'A',
      status          text CHECK (status IN ('pending','submitted','approved','rejected')) DEFAULT 'pending',
      submitted_by    text,
      approved_date   timestamptz,
      created_at      timestamptz DEFAULT now()
    );

    -- S21: Cash flow records
    CREATE TABLE IF NOT EXISTS cash_flow_records (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        uuid NOT NULL,
      project_id       uuid,
      period           text NOT NULL,
      planned_inflow   numeric DEFAULT 0,
      actual_inflow    numeric DEFAULT 0,
      planned_outflow  numeric DEFAULT 0,
      actual_outflow   numeric DEFAULT 0,
      cumulative_net   numeric DEFAULT 0,
      created_at       timestamptz DEFAULT now()
    );

    -- S22: AI insights
    CREATE TABLE IF NOT EXISTS ai_insights (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id           uuid NOT NULL,
      project_id          uuid,
      module              text CHECK (module IN ('predictive_maintenance','anomaly_detection','schedule_risk','cost_overrun','safety')),
      title               text NOT NULL,
      description         text,
      confidence          integer DEFAULT 80,
      severity            text CHECK (severity IN ('critical','high','medium','low','info')) DEFAULT 'medium',
      status              text CHECK (status IN ('open','acknowledged','resolved','dismissed')) DEFAULT 'open',
      recommended_action  text,
      created_at          timestamptz DEFAULT now()
    );

    -- S23: Marketplace providers
    CREATE TABLE IF NOT EXISTS marketplace_providers (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id         uuid NOT NULL,
      name              text NOT NULL,
      category          text CHECK (category IN ('data_feed','analytics','epc_tool','compliance','finance','field_service')),
      description       text,
      logo_url          text,
      integration_type  text CHECK (integration_type IN ('api','webhook','file_import','oauth')),
      status            text CHECK (status IN ('available','connected','pending','deprecated')) DEFAULT 'available',
      rating            numeric DEFAULT 0,
      review_count      integer DEFAULT 0,
      created_at        timestamptz DEFAULT now()
    );
  `

  const { error } = await sb.rpc('exec_sql', { sql: ddl })
  if (error) {
    // Try running each statement individually if exec_sql RPC doesn't exist
    const statements = ddl.split(';').map(s => s.trim()).filter(Boolean)
    const errors: string[] = []
    for (const stmt of statements) {
      const { error: e } = await sb.rpc('exec_sql', { sql: stmt })
      if (e) errors.push(e.message)
    }
    if (errors.length) {
      return NextResponse.json({ ok: false, errors }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    tables: ['opportunities', 'handover_records', 'cash_flow_records', 'ai_insights', 'marketplace_providers'],
    message: 'All S08–S23 tables created (IF NOT EXISTS)',
  })
}
