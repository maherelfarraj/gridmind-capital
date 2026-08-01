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

## Pending / Blocked Migrations (as of 2026-07-31)

Two migrations are committed but **NOT applied to production** (project
`zmahjutrpvwjcmhkiibj`). Verified live via `information_schema` / `pg_trigger`.

| Migration | Status | Notes |
|---|---|---|
| `20260731005000_add_profiles_external_org.sql` | **Ready to apply** | Additive, nullable, idempotent. |
| `20260731010000_p0_identity_and_dml_lockdown.sql` | 🚫 **BLOCKED** | Must not be applied before the migration above. |

### Required apply order

Apply `20260731005000` **first**, then `20260731010000`. The filenames sort in
this order already.

### Why the P0 migration is blocked

`profile_protect_sensitive_fields()` dereferences `NEW.external_org` and
`OLD.external_org`, but **`profiles.external_org` does not currently exist** in
production (verified: `profiles` has 14 columns and this is not one of them; no
migration in this repo has ever created it).

plpgsql does **not** validate record field references at `CREATE FUNCTION` time.
So the P0 migration would apply **cleanly and silently**, and then raise

```
record "new" has no field "external_org"
```

on **every INSERT or UPDATE to `profiles`** — locking the table and breaking all
sign-up, provisioning, and profile writes. The failure appears at runtime, not
at apply time, so a successful apply is not evidence that it is safe.

`20260731005000` creates the column and clears this block.

### Related known breakage (present in production right now)

Because `external_org` is missing, code already deployed that references it
fails with `42703` (undefined column):

- `lib/auth/provisioning.ts` — `AUTHORITY_COLUMNS` lists it in the **SELECT**, so
  every provisioning call fails on read, before any write.
- `lib/db/queries.ts:806` — `getOrgDirectory()` selects it and throws, so
  `/admin/roles-flow` is non-functional.

Applying `20260731005000` resolves both.

## Notes

- All migrations are idempotent (safe to re-run)
- Migrations maintain backward compatibility
- No destructive changes are applied automatically; require explicit review
