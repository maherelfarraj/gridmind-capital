-- Idempotent: Drop + recreate profiles_role_check adding 'client_viewer' to allowed roles
-- Applied via SQL Editor (NOT via v0) to prod by schema owner

-- Remove old constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Re-create constraint with 'client_viewer' added to the list
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN (
    'system_admin',
    'tenant_admin',
    'project_manager',
    'approver',
    'field_coordinator',
    'data_analyst',
    'client_viewer'  -- New role for read-only client access
  )
);
