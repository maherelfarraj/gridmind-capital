-- Batch 15: Create missing views + RPC for team workload and copilot usage tracking

-- ─── VIEW: v_person_workload ─────────────────────────────────────────────
-- Maps team members to their active project assignments (scope, roles, count).
-- Used by lib/db/queries.ts:649 for /team/workload dashboard.
CREATE OR REPLACE VIEW v_person_workload AS
SELECT
  p.id as person_id,
  p.email,
  p.name,
  STRING_AGG(DISTINCT pr.project_code, ', ') as project_scopes,
  STRING_AGG(DISTINCT arr.role, ', ') as assigned_roles,
  COUNT(DISTINCT pr.id) as active_project_count,
  MAX(pr.updated_at) as last_activity
FROM person p
LEFT JOIN person_role_assignment arr ON arr.person_id = p.id AND arr.status = 'active'
LEFT JOIN project_role pr ON pr.id = arr.role_id
WHERE p.status = 'active'
GROUP BY p.id, p.email, p.name;

-- ─── VIEW: v_person_task_load ────────────────────────────────────────────
-- Maps team members to their active task counts (by priority + status).
-- Used by lib/db/queries.ts:658 for /team/tasks dashboard.
CREATE OR REPLACE VIEW v_person_task_load AS
SELECT
  ta.assignee_id as person_id,
  p.email,
  p.name,
  COUNT(*) FILTER (WHERE t.priority = 'high' AND t.status != 'closed') as high_priority_open,
  COUNT(*) FILTER (WHERE t.priority = 'medium' AND t.status != 'closed') as medium_priority_open,
  COUNT(*) FILTER (WHERE t.priority = 'low' AND t.status != 'closed') as low_priority_open,
  COUNT(*) FILTER (WHERE t.status = 'closed') as completed_tasks,
  MAX(t.updated_at) as last_task_update
FROM task_assignment ta
JOIN person p ON p.id = ta.assignee_id
LEFT JOIN task t ON t.id = ta.task_id
WHERE p.status = 'active'
GROUP BY ta.assignee_id, p.email, p.name;

-- ─── RPC: increment_copilot_usage ────────────────────────────────────────
-- Increments copilot token usage for current user (used by copilot.ts:617).
-- Tracks usage_tokens, updates updated_at to current timestamp.
CREATE OR REPLACE FUNCTION increment_copilot_usage(p_token_count INT)
RETURNS TABLE (user_id UUID, usage_tokens INT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE copilot_usage
  SET usage_tokens = COALESCE(usage_tokens, 0) + p_token_count,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = v_user_id
  RETURNING user_id, usage_tokens, updated_at;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_copilot_usage(INT) TO authenticated;
