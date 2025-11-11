# Schema Migration Workflow Guide

Step-by-step guide for using the GitHub Action workflow to apply database schema migrations.

## Overview

The schema migration workflow (`.github/workflows/schema-migration.yml`) provides a standardized, safe process for applying database schema changes with version tracking and rollback support.

## Prerequisites

- GitHub repository with workflow enabled
- GitHub Secrets configured:
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_SERVICE_KEY` - Supabase service role key
  - `SUPABASE_ACCESS_TOKEN` - Supabase access token (optional, for CLI)
  - `SUPABASE_DB_PASSWORD` - Database password (optional, for CLI)
- Migration file created in `supabase/migrations/`
- Schema version determined (semantic versioning)

## Workflow Inputs

When triggering the workflow manually, you'll need to provide:

### Required Inputs

- **Migration File**: Path to migration file (e.g., `supabase/migrations/20251110000000_add_column.sql`)
- **Schema Version**: Schema version using semantic versioning (e.g., `2.1.0`)
- **Release Notes**: Description of the schema change
- **Environment**: `staging` or `production`

### Optional Inputs

- **App Version**: App version if schema change requires frontend updates (e.g., `1.1.0`)
- **Rollback SQL**: SQL to reverse the migration (stored for easy access)

## Step-by-Step Process

### Step 1: Create Migration File

**Use CLI (MCP cannot create files):**

```bash
npm run supabase:migration:new add_tax_rate_to_products
```

Edit the migration file and write your SQL:

```sql
-- Migration: Add tax_rate column to products table
BEGIN;

ALTER TABLE products 
ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00;

COMMIT;
```

### Step 2: Write Rollback SQL

Always write reversible SQL:

```sql
-- Rollback: Remove tax_rate column
ALTER TABLE products DROP COLUMN tax_rate;
```

### Step 3: Review Migration

- [ ] SQL syntax is correct
- [ ] No breaking changes (or documented if breaking)
- [ ] Rollback SQL is correct
- [ ] Data migrations are safe (if any)
- [ ] Constraints are appropriate

### Step 4: Test in Staging

1. Apply migration to staging database manually
2. Test API contracts
3. Verify frontend compatibility
4. Test rollback procedure

### Step 5: Backup Database

**Before production migration:**

1. Create database backup via Supabase Dashboard
2. Store backup securely
3. Document backup location

### Step 6: Trigger Workflow

1. Go to GitHub repository → Actions
2. Select "Schema Migration" workflow
3. Click "Run workflow"
4. Fill in workflow inputs:
   - **Migration File**: `supabase/migrations/20251110000000_add_tax_rate_to_products.sql`
   - **Schema Version**: `2.1.0`
   - **Release Notes**: `Add tax_rate column to products table`
   - **Environment**: `staging` (first) or `production`
   - **App Version**: `1.1.0` (if frontend also updated)
   - **Rollback SQL**: `ALTER TABLE products DROP COLUMN tax_rate;`
5. Click "Run workflow"

### Step 7: Apply Migration

**Option A: Use MCP (Recommended - Faster)**
- In Cursor chat: "Apply migration [migration_name]"
- MCP will read the migration file and apply it directly
- No CLI or terminal needed

**Option B: Use CLI**
```bash
npm run supabase:db:push
```

**Option C: Use GitHub Workflow**
The workflow will:

1. **Validate migration file**: Checks if file exists and schema version format
2. **Display preview**: Shows migration SQL preview
3. **Apply migration**: 
   - If Supabase CLI is available, applies via CLI
   - Otherwise, provides manual instructions
4. **Update schema version**: Updates database via RPC function
5. **Store rollback SQL**: Saves rollback SQL in database
6. **Log results**: Displays migration results and next steps

### Step 8: Verify Migration

After workflow completes:

- [ ] Verify migration in Supabase Dashboard
- [ ] Test API contracts
- [ ] Monitor Supabase logs for errors
- [ ] Verify frontend compatibility (if app version updated)
- [ ] Check version sync

## Workflow Steps Explained

### 1. Validate Migration File

- Checks if migration file exists
- Validates schema version format (semantic versioning)
- Displays migration preview

### 2. Apply Migration

**Option A: Via Supabase CLI (if available)**
- Uses Supabase CLI to apply migration
- Requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets

**Option B: Manual Application (if CLI not available)**
- Provides manual instructions
- Migration must be applied via Supabase Dashboard SQL Editor
- Workflow continues after manual migration

### 3. Update Schema Version

- Calls `update_app_version()` RPC function
- Updates schema version in database
- Optionally updates app version (if provided)
- Stores rollback SQL (if provided)

### 4. Log Results

- Displays migration results
- Shows rollback instructions
- Provides next steps

## Input Parameters

### Migration File

**Format**: `supabase/migrations/YYYYMMDDHHMMSS_migration_name.sql`

**Example**: `supabase/migrations/20251110000000_add_tax_rate_to_products.sql`

### Schema Version

**Format**: Semantic versioning (major.minor.patch)

**Examples**:
- `2.1.0` - Minor version (additive change)
- `2.0.0` - Major version (breaking change)
- `2.1.1` - Patch version (non-breaking improvement)

### Release Notes

**Format**: Plain text description

**Example**: `Add tax_rate column to products table for GST calculations`

### App Version (Optional)

**Format**: Semantic versioning (major.minor.patch)

**When to provide**: If schema change requires frontend updates

**Example**: `1.1.0`

### Rollback SQL (Optional)

**Format**: SQL statements to reverse migration

**Example**: `ALTER TABLE products DROP COLUMN tax_rate;`

### Environment

**Options**: `staging` or `production`

**Recommendation**: Always test in `staging` first, then `production`

## Safety Features

### Validation

- Migration file existence check
- Schema version format validation
- Migration SQL preview

### Manual Approval

- Requires manual workflow trigger
- No automatic execution
- Review before execution

### Rollback Support

- Rollback SQL stored in database
- Easy access for rollback procedures
- Documented rollback instructions

### Error Handling

- Validates inputs before execution
- Checks HTTP responses
- Provides clear error messages
- Logs all steps for auditability

## Examples

### Example 1: Simple Schema Change (Add Column)

**Migration File**: `supabase/migrations/20251110000000_add_tax_rate.sql`

**Workflow Inputs**:
- Migration File: `supabase/migrations/20251110000000_add_tax_rate.sql`
- Schema Version: `2.1.0`
- Release Notes: `Add tax_rate column to products table`
- Environment: `production`
- App Version: (empty)
- Rollback SQL: `ALTER TABLE products DROP COLUMN tax_rate;`

### Example 2: Schema Change with Frontend Update

**Migration File**: `supabase/migrations/20251110000001_add_email_verified.sql`

**Workflow Inputs**:
- Migration File: `supabase/migrations/20251110000001_add_email_verified.sql`
- Schema Version: `2.2.0`
- Release Notes: `Add email verification feature`
- Environment: `production`
- App Version: `1.2.0`
- Rollback SQL: `ALTER TABLE users DROP COLUMN email_verified;`

### Example 3: Performance Optimization (Index)

**Migration File**: `supabase/migrations/20251110000002_add_product_category_index.sql`

**Workflow Inputs**:
- Migration File: `supabase/migrations/20251110000002_add_product_category_index.sql`
- Schema Version: `2.1.1`
- Release Notes: `Add index for products category queries`
- Environment: `production`
- App Version: (empty)
- Rollback SQL: `DROP INDEX idx_products_category;`

## Troubleshooting

### Migration File Not Found

**Error**: `❌ Migration file not found`

**Solution**:
- Verify migration file path is correct
- Check file exists in repository
- Ensure file is committed to Git

### Invalid Schema Version Format

**Error**: `❌ Invalid schema version format`

**Solution**:
- Use semantic versioning format: `major.minor.patch`
- Examples: `2.1.0`, `2.0.0`, `2.1.1`
- Avoid: `2.1`, `v2.1.0`, `2.1.0-beta`

### Migration Application Failed

**Error**: Migration SQL execution failed

**Solution**:
- Check migration SQL for syntax errors
- Verify database permissions
- Check for constraint violations
- Review Supabase logs for details

### Version Update Failed

**Error**: `❌ Failed to update schema version`

**Solution**:
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` secrets are set
- Check RPC function permissions
- Verify database connection
- Review workflow logs for details

### Rollback SQL Not Stored

**Issue**: Rollback SQL not available after migration

**Solution**:
- Verify rollback SQL was provided in workflow inputs
- Check database for stored rollback SQL
- Manually document rollback SQL if needed

## Best Practices

### Before Migration

- [ ] Review migration SQL carefully
- [ ] Test in staging first
- [ ] Create database backup
- [ ] Verify rollback SQL is correct
- [ ] Get peer review (if team)

### During Migration

- [ ] Monitor workflow logs
- [ ] Verify migration application
- [ ] Check for errors
- [ ] Verify version update

### After Migration

- [ ] Verify migration in Supabase Dashboard
- [ ] Test API contracts
- [ ] Monitor Supabase logs
- [ ] Verify frontend compatibility
- [ ] Check version sync
- [ ] Document migration results

## Rollback Procedures

### When to Rollback

- Migration causes data corruption
- Migration breaks existing functionality
- Migration causes performance issues
- Migration has unintended side effects

### How to Rollback

1. **Get Rollback SQL**:
   ```sql
   SELECT rollback_sql 
   FROM app_versions 
   WHERE schema_version = '2.1.0' 
   AND is_current = true;
   ```

2. **Execute Rollback SQL**:
   - Go to Supabase Dashboard → SQL Editor
   - Copy rollback SQL
   - Execute rollback SQL

3. **Update Schema Version**:
   ```sql
   SELECT update_app_version(
     NULL,  -- Keep current app version
     'Rollback: Revert tax_rate column addition',
     '2.0.0',  -- Previous schema version
     NULL  -- No rollback SQL needed for rollback
   );
   ```

4. **Verify Rollback**:
   - Test application functionality
   - Verify data integrity
   - Check for errors

## Manual Migration Process

If GitHub Action workflow is not available, follow manual process:

1. **Apply Migration**:
   ```bash
   npm run db:migrate
   ```
   Or via Supabase Dashboard SQL Editor

2. **Update Schema Version**:
   ```sql
   SELECT update_app_version(
     '1.1.0',  -- App version (if updated)
     'Add tax_rate column to products',
     '2.1.0',  -- Schema version
     'ALTER TABLE products DROP COLUMN tax_rate;'  -- Rollback SQL
   );
   ```

3. **Verify**:
   - Check migration success
   - Verify version update
   - Test functionality

## Security Considerations

### Secrets Management

- Store secrets in GitHub Secrets (not in code)
- Use service role key for RPC calls (bypasses RLS)
- Never commit secrets to Git
- Rotate keys periodically

### Access Control

- Limit workflow execution to authorized users
- Require manual approval for production
- Review workflow logs regularly
- Monitor for unauthorized access

### Data Protection

- Always backup before migrations
- Test rollback procedures
- Monitor for data corruption
- Verify data integrity after migration

## Monitoring

### Workflow Logs

- Review workflow logs after execution
- Check for errors or warnings
- Verify all steps completed successfully
- Document any issues

### Database Logs

- Monitor Supabase logs for errors
- Check for constraint violations
- Verify migration success
- Watch for performance issues

### Version Sync

- Verify schema version matches database structure
- Check app version sync (if updated)
- Monitor version notification alerts
- Verify frontend compatibility

## Resources

- [Schema Migrations Guide](./SCHEMA_MIGRATIONS.md) - Complete schema migration guide
- [Deployment Guide](./DEPLOYMENT.md) - Deployment documentation
- [Supabase Migrations Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

## Support

For issues or questions:
- Check workflow logs for errors
- Review migration SQL for correctness
- Verify GitHub Secrets are set correctly
- Consult team for major changes
- Test in staging first

---

**Last Updated:** 2025-11-10  
**Next Review:** [Set date for next review]

