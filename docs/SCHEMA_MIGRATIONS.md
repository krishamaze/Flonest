# Schema Migrations Guide

Complete guide for managing database schema changes in bill.finetune.store.

## Overview

Schema migrations are structural changes to your database (e.g., adding columns, creating tables, changing types). Unlike app version updates (which are automated), schema changes require manual review, testing, and careful execution due to their high-risk nature.

## Key Concepts

### App Version vs Schema Version

- **App Version**: Tracks frontend code/UI changes (e.g., "1.0.1"). Changes frequently, low-risk, automatically updated.
- **Schema Version**: Tracks database structure changes (e.g., "2.3.0"). Changes rarely, high-risk, manually updated.

### Why Schema Changes Are Critical

Schema changes can:
- **Break existing functionality**: Old code may not work with new schema
- **Cause data loss**: Irreversible changes can lose data
- **Affect data integrity**: Constraint violations, type mismatches
- **Require coordinated deployments**: Frontend and backend must be compatible

## Schema Version Format

Use semantic versioning (major.minor.patch):

- **Major** (e.g., 2.0.0): Breaking changes
  - Removing columns
  - Changing column types
  - Dropping tables
  - Changing constraints that affect data

- **Minor** (e.g., 2.1.0): Additive changes
  - Adding columns
  - Creating new tables
  - Adding indexes (non-breaking)
  - Adding constraints (non-breaking)

- **Patch** (e.g., 2.1.1): Non-breaking improvements
  - Adding indexes
  - Adding constraints
  - Performance optimizations
  - Documentation updates

## Schema Change Workflow

### Step 1: Create Migration File

**Critical Rules:**
1. ❌ NEVER use `supabase migration new` command
2. ✅ Create files manually with format: `YYYYMMDDHHMMSS_description.sql`
3. ✅ Write idempotent SQL that handles "already exists" gracefully

```bash
# Get timestamp (PowerShell)
Get-Date -Format "yyyyMMddHHmmss"

# Example: 20251203151330_add_tax_rate_to_products.sql
```

This creates a new migration file in `supabase/migrations/` with a timestamp prefix.

### Step 2: Write Idempotent Migration SQL

Edit the migration file and write your **idempotent** SQL:

```sql
-- Migration: Add tax_rate column to products table
-- Schema version: 2.1.0 (minor - additive change)

BEGIN;

-- Add tax_rate column (idempotent with DO block)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE products ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00;
  END IF;
END $$;

-- Add check constraint (idempotent with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_tax_rate_range'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT check_tax_rate_range 
    CHECK (tax_rate >= 0 AND tax_rate <= 100);
  END IF;
END $$;

-- Update existing rows (idempotent - WHERE clause prevents re-update)
UPDATE products 
SET tax_rate = 18.00 
WHERE tax_rate IS NULL;

COMMIT;
```

### Step 3: Write Rollback SQL

Always write reversible SQL for rollback:

```sql
-- Rollback: Remove tax_rate column from products table

BEGIN;

-- Remove constraint
ALTER TABLE products
DROP CONSTRAINT IF EXISTS check_tax_rate_range;

-- Remove column
ALTER TABLE products
DROP COLUMN IF EXISTS tax_rate;

COMMIT;
```

### Step 4: Review Migration

- [ ] SQL syntax is correct
- [ ] No breaking changes (or documented if breaking)
- [ ] Rollback SQL is correct and tested
- [ ] Data migrations are safe (if any)
- [ ] Constraints are appropriate
- [ ] Indexes are optimized
- [ ] Performance impact is considered

### Step 5: Test in Staging

```bash
# Apply migration to staging
npm run db:migrate

# Or apply via Supabase Dashboard SQL Editor
```

**Testing Checklist:**
- [ ] Migration applies without errors
- [ ] Data integrity is maintained
- [ ] API contracts work correctly
- [ ] Frontend compatibility is verified
- [ ] Rollback SQL works correctly
- [ ] Performance is acceptable
- [ ] No constraint violations

### Step 6: Backup Database

**Before production migration:**

1. Create database backup via Supabase Dashboard
2. Store backup securely
3. Document backup location
4. Verify backup can be restored

### Step 7: Apply Migration to Production

**Option A: Via Supabase CLI**
```bash
npm run db:migrate
```

**Option B: Via Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy migration SQL
3. Execute migration
4. Verify success

### Step 8: Update Schema Version

After successful migration, update the schema version:

```sql
-- Via Supabase SQL Editor
SELECT update_app_version(
  '1.1.0',  -- App version (if frontend also updated)
  'Add tax_rate column to products table',  -- Release notes
  '2.1.0',  -- Schema version (NEW)
  'ALTER TABLE products DROP CONSTRAINT IF EXISTS check_tax_rate_range; ALTER TABLE products DROP COLUMN IF EXISTS tax_rate;'  -- Rollback SQL
);
```

### Step 9: Update App Version (if needed)

If schema change requires frontend updates:

1. Update `package.json` version
2. Update `FRONTEND_VERSION` in `src/lib/api/version.ts`
3. Deploy frontend code
4. GitHub Action will update app version automatically

### Step 10: Monitor for Errors

After migration:
- [ ] Watch Supabase logs for errors
- [ ] Monitor version notification alerts
- [ ] Check for constraint violations
- [ ] Verify API contracts
- [ ] Test frontend functionality
- [ ] Verify user data integrity
- [ ] Assess performance impact

## Version Coupling Guidelines

### When to Pair Schema Changes with App Version Bumps

**Pair when:**
- Schema changes require frontend updates (e.g., new form fields)
- API contract changes (e.g., new required fields)
- Breaking changes that affect user experience
- New features that require both schema and frontend changes

**Example:**
```sql
-- Schema: Add email_verified column
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Update both versions
SELECT update_app_version(
  '1.1.0',  -- App version (frontend needs to handle new field)
  'Add email verification feature',
  '2.1.0',  -- Schema version
  'ALTER TABLE users DROP COLUMN email_verified;'  -- Rollback
);
```

### When Schema Changes Can Be Independent

**Independent when:**
- Backend-only optimizations (e.g., adding indexes)
- Internal schema improvements (e.g., adding constraints)
- Performance improvements that don't affect API
- Data migrations that don't change API contracts

**Example:**
```sql
-- Schema: Add index for performance
CREATE INDEX idx_products_category ON products(category);

-- Update schema version only (keep current app version)
-- Get current app version first, then update with same app version but new schema version
SELECT update_app_version(
  (SELECT version FROM app_versions WHERE is_current = true LIMIT 1),  -- Keep current app version
  'Add index for products category',
  '2.1.1',  -- Schema version (patch increment)
  'DROP INDEX idx_products_category;'  -- Rollback
);
```

## Rollback Procedures

### When to Rollback

- Migration causes data corruption
- Migration breaks existing functionality
- Migration causes performance issues
- Migration has unintended side effects

### How to Rollback

1. **Stop the application** (if needed)
2. **Execute rollback SQL** (stored in `rollback_sql` column):
   ```sql
   -- Get rollback SQL from app_versions table
   SELECT rollback_sql 
   FROM app_versions 
   WHERE schema_version = '2.1.0' 
   AND is_current = true;
   
   -- Execute rollback SQL
   -- (Copy and execute in Supabase SQL Editor)
   ```
3. **Restore database backup** (if needed):
   - Go to Supabase Dashboard → Database → Backups
   - Restore from backup
4. **Update schema version**:
   ```sql
   -- Revert to previous schema version
   SELECT update_app_version(
     (SELECT version FROM app_versions WHERE is_current = true LIMIT 1),  -- Keep current app version
     'Rollback: Revert tax_rate column addition',
     '2.0.0',  -- Previous schema version
     NULL  -- No rollback SQL needed for rollback
   );
   ```
5. **Verify rollback**:
   - Test application functionality
   - Verify data integrity
   - Check for errors

### Rollback SQL Best Practices

- **Always write reversible SQL**: Every migration should have rollback SQL
- **Test rollback in staging**: Verify rollback works before production
- **Store rollback SQL**: Save in `rollback_sql` column for easy access
- **Document rollback procedure**: Include in migration notes
- **Keep backups**: Always backup before major migrations

## Common Schema Change Patterns

### Adding a Column

```sql
-- Migration
ALTER TABLE products 
ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00;

-- Rollback
ALTER TABLE products 
DROP COLUMN tax_rate;
```

### Removing a Column

```sql
-- Migration
ALTER TABLE products 
DROP COLUMN old_column;

-- Rollback (if data was backed up)
ALTER TABLE products 
ADD COLUMN old_column TEXT;
-- Then restore data from backup
```

### Changing Column Type

```sql
-- Migration
ALTER TABLE products 
ALTER COLUMN price TYPE DECIMAL(10,2);

-- Rollback
ALTER TABLE products 
ALTER COLUMN price TYPE INTEGER;
```

### Adding an Index

```sql
-- Migration
CREATE INDEX idx_products_category ON products(category);

-- Rollback
DROP INDEX idx_products_category;
```

### Adding a Constraint

```sql
-- Migration
ALTER TABLE products
ADD CONSTRAINT check_price_positive 
CHECK (price > 0);

-- Rollback
ALTER TABLE products
DROP CONSTRAINT check_price_positive;
```

### Creating a Table

```sql
-- Migration
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rollback
DROP TABLE product_reviews;
```

## Best Practices

### Planning

- **Plan ahead**: Schema changes should be planned and documented
- **Review with team**: Get peer review for major changes
- **Test thoroughly**: Always test in staging first
- **Backup always**: Create backups before production migrations

### Execution

- **One change per migration**: Keep migrations focused and reversible
- **Use transactions**: Wrap migrations in BEGIN/COMMIT
- **Handle errors gracefully**: Use IF EXISTS/IF NOT EXISTS where appropriate
- **Document changes**: Include clear comments and release notes

### Monitoring

- **Watch logs**: Monitor Supabase logs for errors
- **Check constraints**: Verify no constraint violations
- **Test functionality**: Verify application works correctly
- **Monitor performance**: Check for performance regressions

### Rollback

- **Always have rollback SQL**: Every migration should be reversible
- **Test rollback**: Verify rollback works in staging
- **Store rollback SQL**: Save in database for easy access
- **Keep backups**: Maintain database backups

## Troubleshooting

### Migration Fails

**Error: Column already exists**
```sql
-- Use IF NOT EXISTS
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2);
```

**Error: Constraint violation**
- Check existing data for violations
- Update data before adding constraint
- Use DEFERRABLE constraints if needed

**Error: Type conversion fails**
- Check existing data types
- Use explicit casting
- Migrate data in steps

### Rollback Fails

**Error: Cannot drop column (used by view)**
- Drop dependent views first
- Recreate views after rollback

**Error: Cannot drop constraint (referenced by foreign key)**
- Drop foreign keys first
- Recreate foreign keys after rollback

### Version Sync Issues

**Schema version not updated**
- Verify migration was successful
- Check RPC call was executed
- Verify schema_version column exists

**Schema version out of sync**
- Check current schema version in database
- Compare with expected version
- Update schema version if needed

## Examples

### Example 1: Adding a Column (Simple)

```sql
-- Migration: 20251110000000_add_tax_rate_to_products.sql
BEGIN;

ALTER TABLE products 
ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00;

COMMIT;

-- Rollback SQL:
-- ALTER TABLE products DROP COLUMN tax_rate;

-- Update version:
-- SELECT update_app_version(
--   '1.1.0',
--   'Add tax_rate column to products',
--   '2.1.0',
--   'ALTER TABLE products DROP COLUMN tax_rate;'
-- );
```

### Example 2: Creating a Table (Complex)

```sql
-- Migration: 20251110000001_create_product_reviews.sql
BEGIN;

CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user_id ON product_reviews(user_id);

COMMIT;

-- Rollback SQL:
-- DROP INDEX IF EXISTS idx_product_reviews_user_id;
-- DROP INDEX IF EXISTS idx_product_reviews_product_id;
-- DROP TABLE IF EXISTS product_reviews;

-- Update version:
-- SELECT update_app_version(
--   '1.2.0',
--   'Add product reviews feature',
--   '2.2.0',
--   'DROP INDEX IF EXISTS idx_product_reviews_user_id; DROP INDEX IF EXISTS idx_product_reviews_product_id; DROP TABLE IF EXISTS product_reviews;'
-- );
```

## Resources

- [Supabase Migrations Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL ALTER TABLE Docs](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)

## Support

For issues or questions:
- Check Supabase logs for errors
- Review migration SQL for correctness
- Test in staging first
- Consult team for major changes

---

**Last Updated:** 2025-11-10  
**Next Review:** [Set date for next review]

