---
description: How to create a Supabase migration safely
---

# Creating Supabase Migrations

## Critical Rules

**Rule 1: Manual File Creation Only**
- ❌ NEVER use `supabase migration new` or `npm run supabase:migration:new`
- ✅ ALWAYS create files manually with format: `YYYYMMDDHHMMSS_description.sql`

**Rule 2: Idempotent SQL Required**
- ✅ Every statement MUST handle "already exists" gracefully
- ✅ Migrations must be safely re-runnable without errors

Follow these steps to create migrations that sync properly with the remote database.

## Prerequisites
- Preview branch Supabase project linked: `npx supabase link --project-ref evbbdlzwfqhvcuojlahr`

## Steps

// turbo
1. **Pull latest code**
```bash
git pull origin preview
```

// turbo
2. **Sync remote migrations to local**
```bash
npx supabase db pull
```

This downloads any migration files that exist on the remote database but aren't in your local `supabase/migrations/` directory.

3. **Check for new migration files**
```bash
git status supabase/migrations/
```

4. **If new files appeared, commit them**
```bash
git add supabase/migrations/*.sql
git commit -m "chore(migrations): sync remote migrations"
git push origin preview
```

5. **Create your new migration**

Create the migration file manually with timestamp prefix:
```bash
# Get timestamp (PowerShell)
Get-Date -Format "yyyyMMddHHmmss"

# Example filename: 20251203151330_add_inventory_alerts.sql
```

Write your **idempotent** migration SQL in `supabase/migrations/{timestamp}_migration_name.sql`

**Idempotent SQL Examples:**

```sql
-- ✅ CORRECT: Table creation
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  threshold INTEGER NOT NULL
);

-- ✅ CORRECT: Add column (PostgreSQL 9.6+)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'reorder_level'
  ) THEN
    ALTER TABLE products ADD COLUMN reorder_level INTEGER DEFAULT 10;
  END IF;
END $$;

-- ✅ CORRECT: Create/replace function
CREATE OR REPLACE FUNCTION check_stock_level()
RETURNS TRIGGER AS $$
BEGIN
  -- function body
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ CORRECT: Create index
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(category);

-- ✅ CORRECT: Drop if exists
DROP INDEX IF EXISTS idx_old_products_category;
DROP FUNCTION IF EXISTS old_function_name CASCADE;

-- ❌ WRONG: Non-idempotent (will fail on re-run)
CREATE TABLE inventory_alerts (...);
ALTER TABLE products ADD COLUMN reorder_level INTEGER;
CREATE INDEX idx_products_category ON products(category);
```

6. **Commit and push**
```bash
git add supabase/migrations/
git commit -m "feat(schema): your migration description"
git push origin preview
```

7. **Verify deployment**

Check Vercel preview logs for:
```
Applying migration... {your_migration_name}
Migration applied successfully
```

## Why This Workflow?

**Problem:** If remote has migrations A, B, C but local only has A, B, creating migration D locally will fail on push because C is missing from local history.

**Solution:** `supabase db pull` fetches C before you create D, keeping migration history complete and ordered.

## Troubleshooting

### "Remote migration versions not found in local migrations directory"

This means remote has migrations you don't have locally.

**Fix:**
1. Run `npx supabase db pull`
2. Commit any new files
3. Push again

### Migration already applied on remote

If you accidentally pushed and it auto-applied, the migration is now on remote but may not be in git.

**Fix:**
1. `git pull origin preview` (fetch latest from team)
2. `npx supabase db pull` (fetch migration files from remote)
3. `git add` and commit any new migration files
4. Proceed normally

## Best Practices

**Critical Rules:**
- ✅ **Rule 1**: Create files manually with YYYYMMDDHHMMSS_description.sql format
- ✅ **Rule 2**: Write idempotent SQL (IF NOT EXISTS, CREATE OR REPLACE, etc.)
- ❌ **NEVER** use `supabase migration new` command

**Workflow:**
- ✅ Always pull before creating migrations
- ✅ Use MCP `apply_migration` tool for testing on preview
- ✅ Never modify existing migration files after they're pushed
- ✅ Test migrations on preview branch before merging to main
- ✅ Verify idempotency by running migration twice in test environment
- ❌ Don't create migrations with timestamps in the past
- ❌ Don't delete migration files that have been applied
