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

CREATE INDEX idx_copilot_conversations_tenant_id ON copilot_conversations(tenant_id);
CREATE INDEX idx_copilot_conversations_user_id ON copilot_conversations(user_id);
CREATE INDEX idx_copilot_conversations_created_at ON copilot_conversations(created_at DESC);

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

CREATE INDEX idx_copilot_messages_conversation_id ON copilot_messages(conversation_id);
CREATE INDEX idx_copilot_messages_created_at ON copilot_messages(created_at DESC);

-- Enable RLS
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for copilot_conversations
-- Users can only access their own conversations within their tenant
CREATE POLICY copilot_conversations_tenant_isolation ON copilot_conversations
  USING (tenant_id = auth.uid()::text::uuid)
  WITH CHECK (tenant_id = auth.uid()::text::uuid);

CREATE POLICY copilot_conversations_user_access ON copilot_conversations
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for copilot_messages
-- Users can access messages in their own conversations
CREATE POLICY copilot_messages_access ON copilot_messages
  USING (
    conversation_id IN (
      SELECT id FROM copilot_conversations
      WHERE user_id = auth.uid() AND tenant_id = current_setting('app.tenant_id')::uuid
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM copilot_conversations
      WHERE user_id = auth.uid() AND tenant_id = current_setting('app.tenant_id')::uuid
    )
  );
