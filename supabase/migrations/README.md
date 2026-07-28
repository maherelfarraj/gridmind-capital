# Supabase Migrations — Schema Versioning

## Migration Discipline

All DDL (Data Definition Language) changes must follow this process:

1. **Create an idempotent migration file** in this directory: `YYYYMMDD000N_description.sql`
   - Use `IF NOT EXISTS` for CREATE statements
   - Use `DROP ... IF EXISTS` before re-creating objects
   - Include `BEGIN; ... COMMIT;` or implicit transaction wrapper
   - Add a comment at the top explaining the change

2. **File naming convention:**
   - `20260729000000_baseline.sql` — Composite baseline snapshot (production schema reference)
   - `20260729000001_client_viewer_role.sql` — First new migration after baseline
   - Increment the suffix (000000, 000001, ...) for each change

3. **Test migrations locally:**
   - In a new environment, apply `20260729000000_baseline.sql` once
   - Then apply numbered migrations (000001, 000002, ...) in order
   - Verify schema is correct after each file

4. **Before code ships:**
   - Write and test the migration file
   - Commit the migration file to git
   - Reference the migration by filename in deployment notes
   - Code that depends on the schema should NOT ship until the migration is applied to the target environment

5. **Production deployments:**
   - Only the schema owner applies migrations to production via the Supabase SQL Editor
   - Provide the migration file content (do NOT run the file directly)
   - Wait for migration to complete before deploying code

## Baseline (20260729000000)

The baseline file is a composite snapshot of all tables, indexes, RLS policies, and functions as of Sprint 1 close (2026-07-29). It is safe to apply to new environments. **Do NOT re-run against production.**

For drift detection or schema recovery, use this file as a reference. If you suspect schema corruption on production, contact the DBA and provide the baseline file for comparison.

## Notes

- All migrations are idempotent (safe to re-run)
- Migrations maintain backward compatibility
- No destructive changes are applied automatically; require explicit review
