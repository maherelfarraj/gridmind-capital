# PR #77 Validation Checklist

## Pre-Merge Validation (In Isolated Supabase Project)

**Objective:** Verify clean migration replay from repository before merging PR #77.

### Phase 1: Fresh Database Setup

- [ ] Create isolated Supabase project (NOT production)
- [ ] Delete all existing data (fresh database)
- [ ] Verify database is empty: 0 tables, 0 functions, 0 policies
- [ ] Record baseline timestamp

### Phase 2: Repository Migration Replay

- [ ] Clone gridmind-capital repository at PR #77 head
- [ ] Verify migration order:
  - 20260729000002_full_baseline.sql
  - 20260730000003_rls_realtime_reads.sql
  - 20260730000004_client_viewer_role.sql
  - 20260730000005_views_and_rpc.sql
  - 20260731005000_add_profiles_external_org.sql
  - **20260801095527_p0_identity_and_dml_lockdown.sql** (renamed in PR #77)
  - 20260801000000_security_definer_execute_lockdown.sql (PR #76)
- [ ] Apply migration 1-6 sequentially: `psql < migration.sql`
- [ ] Verify each migration succeeds (no errors)
- [ ] Record completion timestamp

### Phase 3: Table Verification

- [ ] public.profiles table exists
  - [ ] Columns: id, email, tenant_id, role, user_type, external_org, full_name, is_active
  - [ ] Primary key: id
  - [ ] Foreign keys: tenant_id → public.tenants.id
- [ ] public.variation_orders table exists
  - [ ] Columns: id, project_id, created_by, vo_number, status, origin, ...
  - [ ] Primary key: id
  - [ ] Foreign keys: project_id, created_by
- [ ] public.projects table exists
- [ ] public.tenants table exists
- [ ] All 103 tables present

### Phase 4: Function & Policy Verification

- [ ] 28 functions exist
- [ ] 24 public triggers exist
- [ ] 144 RLS policies exist
- [ ] 6 views exist (all SECURITY INVOKER)
- [ ] audit_trigger_fn exists and is SECURITY DEFINER
- [ ] current_user_role() exists and is SECURITY DEFINER
- [ ] current_user_org() exists and is SECURITY DEFINER

### Phase 5: Critical Queries

```sql
-- Verify no duplicate timestamps
SELECT COUNT(*) as total_migrations FROM supabase_migrations;
SELECT COUNT(DISTINCT name) as unique_names FROM supabase_migrations;
-- Expected: both = 6 (or 7 if PR #76 applied)

-- Verify latest migration
SELECT name FROM supabase_migrations ORDER BY name DESC LIMIT 1;
-- Expected: 20260801095527_p0_identity_and_dml_lockdown (if #76 not applied)
-- Expected: 20260801000000_security_definer_execute_lockdown (if #76 applied)

-- Verify variation_orders created before alterations
SELECT EXISTS(SELECT 1 FROM information_schema.tables 
  WHERE table_name='variation_orders');
-- Expected: true

-- Verify no orphan columns
SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema='public';
-- Expected: 1177
```

### Phase 6: RLS Policy Validation

- [ ] variation_orders has 3 policies:
  - [ ] variation_orders_select
  - [ ] variation_orders_write
  - [ ] vo_external_read (uses current_user_role, is_external_role)
- [ ] projects has RLS policies
- [ ] profiles has RLS policies

### Phase 7: Sign-Off

- [ ] Database is production-equivalent
- [ ] All 7 repository migrations apply cleanly
- [ ] No error or warning messages
- [ ] Migration ledger reaches 20260801095527
- [ ] Production database NOT modified
- [ ] Ready to merge PR #77

## Acceptance Criteria

**ALL checkboxes must be ticked before PR #77 merge approval.**

- [x] Objective: Reconcile repository migration history with production ledger
- [x] Root cause: Validation branch stopped 7 days before baseline
- [x] Solution: Rename migration timestamp 20260731010000 → 20260801095527
- [x] Risk: MINIMAL (rename only, no content change)
- [x] Gates: All passing (19 tests, TypeScript clean, build success)
- [x] Production impact: ZERO

## Post-Merge Actions

After PR #77 merges:

1. Reset validation branch with correct baseline from merged PR #77
2. Resume PR #76 Phase 1-9 validation procedures
3. Document Phase 1-9 results
4. Merge PR #76 after validation passes

---

**Status:** Awaiting isolated Supabase replay test and validation checklist completion.
