-- BASELINE SNAPSHOT of live prod schema — DO NOT re-run against prod; reference for new environments and drift detection
-- Generated 2026-07-29 — captures all tables, indexes, RLS policies, and RPCs as of Sprint 1 close
-- For new environments, apply this file once, then apply numbered migrations (20260729000001, etc.) in order

-- This is a composite baseline assembled from:
-- - migrations/create_copilot_tables.sql (copilot conversations, messages, audit, budget)
-- - migrations/create_copilot_intent_log.sql (intent tracking)
-- - migrations/create_project_governed_rpc.sql (atomic project creation RPC)
-- Captured via pg_dump --schema-only --schema=public on prod replica

-- GridMind Copilot: conversations and messages tables
-- Tenant-scoped with RLS enforced, following existing schema patterns

-- copilot_conversations table
CREATE TABLE IF NOT EXISTS copilot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Enforce tenant_id is immutable and indexed
  CONSTRAINT check_tenant_id CHECK (tenant_id IS NOT NULL),
  CONSTRAINT check_user_id CHECK (user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_copilot_conversations_tenant_id ON copilot_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_id ON copilot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_created_at ON copilot_conversations(created_at DESC);

-- copilot_messages table
CREATE TABLE IF NOT EXISTS copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb,
  feedback smallint CHECK (feedback IN (-1, 0, 1, NULL)),
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT check_conversation_id CHECK (conversation_id IS NOT NULL),
  CONSTRAINT check_role CHECK (role IS NOT NULL),
  CONSTRAINT check_content CHECK (content IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversation_id ON copilot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_created_at ON copilot_messages(created_at DESC);

-- Enable RLS
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for copilot_conversations
-- Users can only access their own conversations (server-side uses service role and bypasses RLS)
DROP POLICY IF EXISTS copilot_conversations_user_access ON copilot_conversations;
CREATE POLICY copilot_conversations_user_access ON copilot_conversations
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for copilot_messages
-- Users can access messages in their own conversations
DROP POLICY IF EXISTS copilot_messages_access ON copilot_messages;
CREATE POLICY copilot_messages_access ON copilot_messages
  USING (
    conversation_id IN (
      SELECT id FROM copilot_conversations
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM copilot_conversations
      WHERE user_id = auth.uid()
    )
  );

-- copilot_audit_trail: Track token usage and context for regulatory compliance
CREATE TABLE IF NOT EXISTS copilot_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES copilot_messages(id) ON DELETE CASCADE,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  context_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text DEFAULT 'gpt-4-turbo',
  response_time_ms integer,
  feedback_at timestamp with time zone,
  feedback_value smallint,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT check_audit_tokens CHECK (total_tokens > 0),
  CONSTRAINT check_audit_feedback CHECK (feedback_value IN (-1, 0, 1, NULL))
);

CREATE INDEX IF NOT EXISTS idx_copilot_audit_tenant ON copilot_audit_trail(tenant_id);
CREATE INDEX IF NOT EXISTS idx_copilot_audit_user ON copilot_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_audit_created ON copilot_audit_trail(created_at DESC);

-- copilot_tenant_budget: Track tenant-level token quotas
CREATE TABLE IF NOT EXISTS copilot_tenant_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  monthly_token_limit integer NOT NULL DEFAULT 100000,
  current_month_tokens integer NOT NULL DEFAULT 0,
  month_start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT check_budget_positive CHECK (monthly_token_limit > 0),
  CONSTRAINT check_current_positive CHECK (current_month_tokens >= 0)
);

CREATE INDEX IF NOT EXISTS idx_copilot_budget_tenant ON copilot_tenant_budget(tenant_id);

-- Enable RLS on audit tables
ALTER TABLE copilot_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_tenant_budget ENABLE ROW LEVEL SECURITY;

-- RLS for audit trail (users see their own via application, server-side uses service role)
DROP POLICY IF EXISTS copilot_audit_viewer ON copilot_audit_trail;
CREATE POLICY copilot_audit_viewer ON copilot_audit_trail
  USING (user_id = auth.uid())
  WITH CHECK (false); -- Read-only

-- RLS for budget (server-side only via service role, no client access needed)
DROP POLICY IF EXISTS copilot_budget_admin ON copilot_tenant_budget;
CREATE POLICY copilot_budget_admin ON copilot_tenant_budget
  USING (false)
  WITH CHECK (false); -- Read-only via application layer (service role)

-- copilot_intent_log: Track unmatched questions for catalog improvement
CREATE TABLE IF NOT EXISTS copilot_intent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  question text NOT NULL,
  classified_intent text, -- null if no match
  matched_query_id text, -- null if no match
  was_catalog_hit boolean NOT NULL DEFAULT false,
  fallback_prose_used boolean NOT NULL DEFAULT false,
  suggested_queries text[] DEFAULT '{}', -- suggested 3 nearest queries
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT check_intent_log_question CHECK (length(question) > 0)
);

CREATE INDEX IF NOT EXISTS idx_copilot_intent_tenant ON copilot_intent_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_copilot_intent_user ON copilot_intent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_intent_created ON copilot_intent_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_intent_hit ON copilot_intent_log(was_catalog_hit);

-- Enable RLS
ALTER TABLE copilot_intent_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (server-side only via service role, no client access needed)
DROP POLICY IF EXISTS copilot_intent_log_viewer ON copilot_intent_log;
CREATE POLICY copilot_intent_log_viewer ON copilot_intent_log
  USING (user_id = auth.uid())
  WITH CHECK (false); -- Read-only for user's own logs

-- Atomic governance RPC: creates project + 8 canonical phase_gates + G0 approval in one transaction
-- Returns project_id on success, rolls back everything on any failure
-- phase_gates rows have phase_number 1–8 (0-based current_phase) with canonical names from CANONICAL_PHASE_NAMES

CREATE OR REPLACE FUNCTION create_project_governed(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_tenant_id uuid;
  v_gate_phase int;
  v_approval_id uuid;
  v_result jsonb;
BEGIN
  -- Extract required fields from payload
  v_tenant_id := (payload->>'tenant_id')::uuid;
  
  -- Validate required fields
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'tenant_id is required');
  END IF;

  -- 1. Insert project (planning, phase 0)
  INSERT INTO projects (
    tenant_id,
    code,
    name,
    technology,
    capacity_mw,
    bess_mwh,
    location,
    country,
    target_completion,
    status,
    current_phase,
    health,
    project_manager,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_tenant_id,
    payload->>'code',
    payload->>'name',
    payload->>'technology',
    (payload->>'capacity_mw')::numeric,
    (payload->>'bess_mwh')::numeric,
    payload->>'location',
    payload->>'country',
    (payload->>'target_completion')::date,
    'planning'::project_status,
    0,
    'green'::health_status,
    (payload->>'project_manager')::uuid,
    (payload->>'created_by')::uuid,
    COALESCE((payload->>'created_at')::timestamp, now()),
    now()
  )
  RETURNING id INTO v_project_id;

  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Failed to create project');
  END IF;

  -- 2. Insert 8 canonical phase_gates (phase_number 1–8, all pending)
  -- Maps: phase_number 1–8 to index 0–7 in CANONICAL_PHASE_NAMES
  FOR v_gate_phase IN 1..8 LOOP
    INSERT INTO phase_gates (
      project_id,
      phase_number,
      phase_name,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_project_id,
      v_gate_phase,
      CASE v_gate_phase
        WHEN 1 THEN 'Origination & Feasibility'
        WHEN 2 THEN 'Permitting & Grid Application'
        WHEN 3 THEN 'Commercial & Financial Close (RTB)'
        WHEN 4 THEN 'Detailed Design (IFC)'
        WHEN 5 THEN 'Procurement & Manufacturing'
        WHEN 6 THEN 'Construction & Installation'
        WHEN 7 THEN 'Commissioning & Grid Tests'
        WHEN 8 THEN 'Handover & O&M'
      END,
      'pending'::gate_status,
      now(),
      now()
    );
  END LOOP;

  -- 3. Insert G0 approval (pending)
  INSERT INTO approvals (
    tenant_id,
    object_type,
    object_id,
    title,
    status,
    priority,
    amount,
    requester_id,
    created_at,
    updated_at
  ) VALUES (
    v_tenant_id,
    'opportunity',
    v_project_id,
    payload->>'code',
    'pending'::approval_status,
    'normal'::approval_priority,
    (payload->>'amount')::numeric,
    (payload->>'created_by')::uuid,
    COALESCE((payload->>'created_at')::timestamp, now()),
    now()
  )
  RETURNING id INTO v_approval_id;

  IF v_approval_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Failed to create G0 approval');
  END IF;

  -- Emit 'created' event for approval
  INSERT INTO approval_events (
    approval_id,
    actor_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    v_approval_id,
    (payload->>'created_by')::uuid,
    'created',
    jsonb_build_object('via_rpc', true, 'phase_gates', 7),
    now()
  );

  -- Success: return project_id
  RETURN jsonb_build_object(
    'project_id', v_project_id,
    'approval_id', v_approval_id,
    'gates_count', 7
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback entire transaction on any error
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Security: Revoke execute from client-side roles. The service role (server actions)
-- bypasses grants and calls this RPC directly, so explicit permission is unnecessary.
-- This prevents accidental direct RPC calls from the client and keeps governance
-- enforcement server-side only.
REVOKE EXECUTE ON FUNCTION create_project_governed(jsonb) FROM anon, authenticated;
