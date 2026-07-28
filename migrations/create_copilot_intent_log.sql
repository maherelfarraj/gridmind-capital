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

-- RLS policies
DROP POLICY IF EXISTS copilot_intent_log_viewer ON copilot_intent_log;
CREATE POLICY copilot_intent_log_viewer ON copilot_intent_log
  USING (user_id = auth.uid())
  WITH CHECK (false); -- Read-only

DROP POLICY IF EXISTS copilot_intent_log_admin ON copilot_intent_log;
CREATE POLICY copilot_intent_log_admin ON copilot_intent_log
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (false); -- Admin read-only
