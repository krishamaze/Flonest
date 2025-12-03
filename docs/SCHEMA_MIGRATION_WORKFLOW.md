# Schema Migration Workflow Guide

This document outlines the mandatory 7-step GitOps process for applying database schema migrations.

**CRITICAL RULE:**
❌ **NEVER** use `supabase db push` or `npm run supabase:db:push`.
✅ **ALWAYS** use the GitOps workflow described below.
✅ Migrations are applied automatically by the Supabase Integration when code is pushed to specific branches.

## Prerequisites

- Local Supabase CLI installed and running.
- Feature branch with valid migration file in `supabase/migrations/`.
- Local verification complete (using `npx supabase start` or `restart`).

## The 7-Step GitOps Process

### Step 1: Develop & Test Locally
Create your migration file manually and test it locally.

**Critical Rules:**
1. ❌ NEVER use `supabase migration new`
2. ✅ Create manually: `YYYYMMDDHHMMSS_description.sql`
3. ✅ Write idempotent SQL (IF NOT EXISTS, CREATE OR REPLACE, etc.)

```bash
# Get timestamp (PowerShell)
Get-Date -Format "yyyyMMddHHmmss"

# Create file: supabase/migrations/YYYYMMDDHHMMSS_your_migration_name.sql
# Example: supabase/migrations/20251203151330_add_inventory_alerts.sql

# Write idempotent SQL, then apply locally:
npx supabase start  # or npx supabase restart
```

### Step 2: Target Preview Branch
Switch to the `preview` branch and ensure it is up to date.
```bash
git checkout preview
git pull origin preview
```

### Step 3: Merge Feature
Merge your feature branch (e.g., `ui-layout-polish`) into `preview`.
```bash
git merge your-feature-branch
```

### Step 4: Trigger Preview Deployment
Push to `origin preview` to trigger the Supabase Integration.
```bash
git push origin preview
```
*Action:* This automatically applies pending migrations to the **Preview** Supabase project.

### Step 5: Verify Deployment
Watch the GitHub Actions/Vercel logs.
- Ensure migrations applied successfully.
- Verify the application in the Preview environment.
- Check for `PGRST` errors or schema mismatches.

### Step 6: Promote to Production
Once Preview is verified, switch to `main` and merge `preview`.
```bash
git checkout main
git merge preview
```

### Step 7: Trigger Production Deployment
Push to `origin main` to trigger the Supabase Integration.
```bash
git push origin main
```
*Action:* This automatically applies pending migrations to the **Production** Supabase project.

## Troubleshooting

### Migration Failed on Preview/Production
1. check the GitHub Actions logs.
2. If a migration fails, **do not** manually fix it in the dashboard.
3. Create a new "fix" migration locally, apply it, and push through the full 7-step process again.

### Schema Mismatch
If you see 404s or PostgREST errors:
- Ensure the migration file names are timestamped correctly (lexicographical order).
- Ensure no `COMMIT` or `BEGIN` statements are in the migration files (Supabase handles transactions).
- Force a service restart locally to verify: `npx supabase restart`.

## Security & Best Practices

- **Never** merge directly to `main` without passing through `preview`.
- **Never** modify the live database directly via Dashboard SQL Editor (unless emergency).
- **Always** verify locally before pushing.
