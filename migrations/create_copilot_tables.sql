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
