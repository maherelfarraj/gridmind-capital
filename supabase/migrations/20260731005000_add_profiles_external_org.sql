-- Add the missing profiles.external_org column.
--
-- WHY THIS EXISTS
-- ---------------
-- Verified against the live production database (project zmahjutrpvwjcmhkiibj)
-- on 2026-07-31 via information_schema: public.profiles has exactly 14 columns
-- and external_org is NOT one of them. No migration in this repository has ever
-- created it, yet four separate places already depend on it:
--
--   1. lib/auth/provisioning.ts  - AUTHORITY_COLUMNS lists external_org in the
--                                  SELECT, so loadProfileAuthority() currently
--                                  fails with 42703 (undefined column) and
--                                  EVERY provisioning call errors out. It is
--                                  also written on provision/convert/role-change.
--   2. lib/db/queries.ts:806     - getOrgDirectory() selects it and throws on
--                                  error, so /admin/roles-flow is already dead
--                                  in production.
--   3. components/admin/roles-flow-workspace.tsx:173 - renders u.external_org.
--   4. supabase/migrations/20260731010000_p0_identity_and_dml_lockdown.sql -
--                                  profile_protect_sensitive_fields() reads
--                                  NEW.external_org / OLD.external_org.
--
-- ORDERING (important)
-- --------------------
-- This migration is deliberately timestamped BEFORE 20260731010000 so that the
-- column exists before the P0 lockdown trigger is installed. The P0 migration
-- is currently NOT APPLIED to production. It must not be applied before this
-- one: plpgsql does not validate record field references at CREATE FUNCTION
-- time, so that trigger would install cleanly and then raise
--   record "new" has no field "external_org"
-- on every INSERT or UPDATE to profiles, locking the table entirely.
--
-- SAFETY
-- ------
-- Additive and nullable, so no existing row is rewritten and no existing INSERT
-- or UPDATE breaks. Guarded with IF NOT EXISTS so it is safe to re-run and safe
-- against a database where the column was added out of band.
--
-- Existing rows are intentionally left NULL rather than backfilled: the correct
-- organisation for each historical external user is not derivable from data in
-- this database. Application code already treats NULL as "unknown org"
-- (roles-flow-workspace.tsx falls back to 'Unknown org'), and
-- lib/auth/provisioning.ts requires a non-empty org on any subsequent
-- provisioning or internal-to-external conversion, so values fill in going
-- forward.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS external_org text;

COMMENT ON COLUMN public.profiles.external_org IS
  'Organisation an external user (e.g. subcontractor, client_viewer) belongs to. '
  'NULL for internal users. Protected field: written only by lib/auth/provisioning.ts.';
