# Environment Variables Setup

## Required Variables

### For Supabase CLI (Migrations, Linking)

```env
# Database password for CLI operations
SUPABASE_DB_PASSWORD=your-database-password-here

# Access token from 'npx supabase login'
SUPABASE_ACCESS_TOKEN=your-access-token-here
```

**Get these from:**
- `SUPABASE_DB_PASSWORD`: Supabase Dashboard → Project Settings → Database
- `SUPABASE_ACCESS_TOKEN`: Run `npx supabase login` (stored automatically)

### For App Runtime (Frontend)

```env
# Supabase project URL
VITE_SUPABASE_URL=https://yzrwkznkfisfpnwzbwfw.supabase.co

# Supabase anonymous key
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Get these from:**
- Supabase Dashboard → Project Settings → API

## Optional Variables

These are **NOT required** for CLI operations. Only add if you need direct database access from other tools:

```env
# Direct database connection URL (optional)
# Only needed if you use tools like psql, pgAdmin, or custom scripts
DATABASE_URL=postgresql://postgres:password@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres

# Connection pooler URL (optional)
# Only needed if you use transaction pooler for specific tools
DATABASE_DIRECT_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## Recommended .env File

```env
# =============================================================================
# Required for App Runtime (Frontend)
# =============================================================================
VITE_SUPABASE_URL=https://yzrwkznkfisfpnwzbwfw.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# =============================================================================
# Required for CLI Operations (Migrations, Linking)
# =============================================================================
SUPABASE_DB_PASSWORD=your-database-password-here
SUPABASE_ACCESS_TOKEN=your-access-token-here

# =============================================================================
# Optional: Service Role Key (for Admin Scripts)
# =============================================================================
# Required for scripts like create-internal-user.cjs
# Get from: Supabase Dashboard → Project Settings → API → Service Role Key
# ⚠️  Keep this secret! Never commit to Git. Has admin access (bypasses RLS).
# SUPABASE_SERVICE_KEY=your-service-role-key-here

# =============================================================================
# Optional: Direct Database Access (Only if needed)
# =============================================================================
# DATABASE_URL=postgresql://postgres:password@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres
# DATABASE_DIRECT_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## GitHub Secrets (for Version Updates)

These secrets are required for the GitHub Action that automatically updates the database app version after deployment:

```env
# GitHub Secrets (set in GitHub repository settings)
SUPABASE_URL=https://yzrwkznkfisfpnwzbwfw.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Get these from:**
- `SUPABASE_URL`: Supabase Dashboard → Project Settings → API → Project URL
- `SUPABASE_SERVICE_KEY`: Supabase Dashboard → Project Settings → API → Service Role Key (⚠️ Keep this secret!)

**Important Notes:**
- These are stored as GitHub Secrets, NOT in `.env` file
- `SUPABASE_SERVICE_KEY` is different from `VITE_SUPABASE_ANON_KEY`
- Service role key bypasses RLS - only use for automated scripts
- Never commit service role key to Git
- Used for app version updates only (not schema versions)

**How to add GitHub Secrets:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `SUPABASE_URL` with your Supabase project URL
4. Add `SUPABASE_SERVICE_KEY` with your service role key

## Schema Version Tracking

The system tracks two separate version types:

- **App Version**: Tracks frontend code/UI changes (e.g., "1.0.1"). Automatically updated via GitHub Action.
- **Schema Version**: Tracks database structure changes (e.g., "2.3.0"). Manually updated after schema migrations.

### Schema Version Format

Use semantic versioning (major.minor.patch):
- **Major**: Breaking changes (e.g., removing columns, changing types)
- **Minor**: Additive changes (e.g., adding columns, new tables)
- **Patch**: Non-breaking changes (e.g., indexes, constraints)

**Example:** `2.3.1` = Major version 2, minor version 3, patch 1

### Schema Version Updates

Schema versions are updated manually after schema migrations via the `update_app_version()` RPC function:

```sql
-- Update schema version after migration
SELECT update_app_version(
  '1.1.0',  -- App version (if also updated)
  'Add tax_rate column to products',  -- Release notes
  '2.1.0',  -- Schema version
  'ALTER TABLE products DROP COLUMN tax_rate;'  -- Rollback SQL (optional)
);
```

**For detailed schema migration workflow, see [Schema Migrations Guide](./docs/SCHEMA_MIGRATIONS.md)**

## Summary

### ✅ Keep in .env:
- `VITE_SUPABASE_URL` - Required for app
- `VITE_SUPABASE_ANON_KEY` - Required for app
- `SUPABASE_DB_PASSWORD` - Required for CLI
- `SUPABASE_ACCESS_TOKEN` - Required for CLI

### ✅ Optional (for admin scripts):
- `SUPABASE_SERVICE_KEY` - Service role key (for scripts like `create-internal-user.cjs`)
  - Get from: Supabase Dashboard → Project Settings → API → Service Role Key
  - ⚠️  Keep this secret! Has admin access (bypasses RLS)
  - Required for creating platform admin accounts locally

### ✅ GitHub Secrets (for automated app version updates):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (for GitHub Actions)

**Note:** Schema versions are updated manually, not via GitHub Actions.

### ⚠️ Optional (Remove if not needed):
- `DATABASE_URL` - Only if you use direct DB access tools
- `DATABASE_DIRECT_URL` - Only if you use connection pooler

**The CLI uses `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` directly, so `DATABASE_URL` and `DATABASE_DIRECT_URL` are not needed for migrations or linking.**

