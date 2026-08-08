-- GM-G3: add the columns createApprovalWorkflow already writes to approvals.
--
-- ROOT CAUSE: app/actions/approvals.ts inserts `gate_number` and `rule_id` into
-- public.approvals and decideApproval selects `gate_number`, but NEITHER column
-- exists on the table. Every gate-workflow insert therefore failed (unknown
-- column), so no approvals / approval_steps / gate lifecycle rows were ever
-- created -- which is exactly why the G3 smoke fixture showed ZERO lifecycle
-- rows. Selecting the missing column made decideApproval return "Approval not
-- found" for any gate.
--
-- These additions are purely additive and nullable, so they cannot break any
-- existing row or query. gate_number identifies which gate an approval governs
-- (drives duplicate detection + the phase state machine); rule_id records which
-- approval_rule produced the workflow.

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS gate_number integer,
  ADD COLUMN IF NOT EXISTS rule_id uuid;

-- Link rule_id to the rule that created the workflow; NULL on rule deletion.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'approvals_rule_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'approval_rules'
  ) THEN
    ALTER TABLE public.approvals
      ADD CONSTRAINT approvals_rule_id_fkey
      FOREIGN KEY (rule_id) REFERENCES public.approval_rules(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Speeds up the gate duplicate-detection query
-- (tenant_id, object_id, object_type, gate_number, status) and the lifecycle
-- lookups by gate.
CREATE INDEX IF NOT EXISTS idx_approvals_gate_lookup
  ON public.approvals (tenant_id, object_id, object_type, gate_number);
