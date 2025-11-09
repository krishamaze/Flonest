# Cloud-Only Development Workflow

Complete guide for cloud-only Supabase development. No Docker required. All database operations work directly against your cloud Supabase project.

## Overview

This project uses **cloud-only development** with Supabase:
- ✅ **No Docker required** - All operations use cloud project
- ✅ **CLI uses ACCESS_TOKEN** - No service role key needed
- ✅ **App uses ANON key** - Standard client-side auth
- ✅ **Migrations are source of truth** - All schema changes via migrations
- ✅ **Shadow DB for diffs** - Managed by Supabase, no local setup needed
- ✅ **Transaction pooler** - Perfect for dev + ORM flows

## Prerequisites

1. **Supabase account** - Sign up at [supabase.com](https://supabase.com)
2. **Node.js 18+** - For running the development server
3. **Supabase CLI** - Already installed via npm (`supabase@^2.54.11`)

## Initial Setup (One-Time)

### 1. Login to Supabase CLI

```bash
npx supabase login
```

This will open your browser to authenticate and store your access token locally.

### 2. Link to Cloud Project

```bash
npm run supabase:link
```

Or manually (with direct connection, no Docker):

```bash
npx supabase link --project-ref yzrwkznkfisfpnwzbwfw --skip-pooler
```

**Important**: Use `--skip-pooler` flag to use direct database connection instead of pooler. This:
- ✅ Avoids Docker requirements
- ✅ Prevents connection timeout issues
- ✅ Works more reliably for migrations

This links your local project to the cloud Supabase project using direct connection.

### 3. Set Up Environment Variables

Create `.env` from the example:

```bash
cp .env.example .env
```

Fill in the required values (see `.env.example` for details):
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_ACCESS_TOKEN` - Automatically stored after `npx supabase login`
- `DATABASE_URL` - Transaction pooler URL (optional, for direct DB access)

### 4. Apply Migrations

Apply existing migrations to your cloud database:

```bash
npm run db:migrate
```

Or manually:

```bash
npx supabase db push --linked
```

### 5. Generate TypeScript Types

Generate TypeScript types from your database schema:

```bash
npm run db:types
```

Or manually:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

## Daily Development Workflow

### Creating a New Feature with Database Changes

1. **Create a feature branch:**

```bash
git checkout -b feat/add-product-table
```

2. **Create a new migration:**

```bash
npm run supabase:migration:new add_product_table
```

This creates a new migration file in `supabase/migrations/` with a timestamp.

3. **Edit the migration file:**

Edit `supabase/migrations/YYYYMMDDHHMMSS_add_product_table.sql`:

```sql
-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  sku TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their tenant's products" ON products
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));
```

4. **Push migration to cloud:**

```bash
npm run db:migrate
```

Or manually:

```bash
npx supabase db push --linked
```

5. **Generate TypeScript types:**

```bash
npm run db:types
```

6. **Start development server:**

```bash
npm run dev
```

7. **Commit changes:**

```bash
git add supabase/migrations/*.sql src/types/database.ts
git commit -m "feat(db): add product table"
```

## Schema Diff Workflow

If you've made changes directly in the Supabase dashboard and want to create a migration from those changes:

1. **Generate migration from diff:**

```bash
npm run supabase:db:diff
```

Or manually:

```bash
npx supabase db diff
```

This compares your cloud database schema with your local migrations and generates a new migration file.

2. **Review the generated migration:**

The migration file will be created in `supabase/migrations/`. Review it to ensure it's correct.

3. **Edit if needed:**

You can modify the migration file before applying it.

4. **Push migration:**

```bash
npm run db:migrate
```

5. **Generate types:**

```bash
npm run db:types
```

## Migration Best Practices

### ✅ Do

- **Create new migrations** for all schema changes
- **Use descriptive names** for migrations (e.g., `add_product_table`, `add_user_email_index`)
- **Test migrations** on a dev project before applying to production
- **Keep migrations small** - One logical change per migration
- **Make migrations reversible** when possible (though rollbacks should be new migrations)
- **Commit migrations to git** - Migrations are the source of truth

### ❌ Don't

- **Don't modify existing migrations** - Once applied, migrations are immutable
- **Don't delete migration files** - They're part of your database history
- **Don't mix schema and data changes** - Separate migrations for schema vs data
- **Don't use `db:reset` on production** - Only use on dev/staging projects

### Rollback Strategy

Supabase migrations are **forward-only**. To rollback:

1. **Create a new migration** that reverses the changes
2. **Push the new migration** to apply the rollback
3. **Don't delete or modify** the original migration

Example:

```sql
-- Migration 1: add_product_table.sql
CREATE TABLE products (...);

-- Migration 2: remove_product_table.sql (rollback)
DROP TABLE products;
```

## Database Reset (⚠️ DESTRUCTIVE)

**Warning:** This will **delete all data** and reset your database to the state defined by your migrations.

### When to Use

- ✅ **Dev/staging projects only** - Never use on production
- ✅ **Testing migration flow** - Ensure migrations work correctly
- ✅ **Starting fresh** - Reset to clean state

### How to Use

```bash
npm run supabase:db:reset
```

Or manually:

```bash
npx supabase db reset --linked
```

This will:
1. Drop all tables and data
2. Reapply all migrations in order
3. Run seed files (if any)

### Safety Guard

For production safety, consider using the guard script before resetting:

```bash
node scripts/guard-db-reset.js
```

This prompts you to type the project ref to confirm before proceeding.

## TypeScript Types

### Generating Types

Generate types from your cloud database:

```bash
npm run db:types
```

This reads your cloud database schema and generates TypeScript types in `src/types/database.ts`.

### When to Regenerate

- ✅ **After schema changes** - After pushing migrations
- ✅ **After manual schema changes** - If you change schema in dashboard
- ✅ **Before committing** - Ensure types are up to date
- ✅ **In CI/CD** - Automate type generation in build process

### Using Types

Import and use types in your code:

```typescript
import type { Database } from '../types/database'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient<Database>(url, key)

// Types are now available
const { data } = await supabase
  .from('products')
  .select('*')
  // TypeScript knows the schema!
```

## Transaction Pooler

### What is it?

The transaction pooler is a connection pooler that supports both IPv4 and IPv6, making it compatible with all networks.

### Why use it?

- ✅ **IPv4 + IPv6 support** - Works on all networks
- ✅ **Better performance** - Connection pooling
- ✅ **Recommended by Supabase** - Best practice for production
- ✅ **ORM compatible** - Works with Prisma, Drizzle, etc.

### Getting the Pooler URL

1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll to "Connection Pooling" section
3. Copy the "Connection string" under "Transaction mode"
4. Add to `.env` as `DATABASE_URL`

### Using the Pooler URL

The pooler URL is used for:
- Direct database access (Prisma, Drizzle, psql)
- ORM connections
- Database scripts

Your app runtime (frontend) uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, not the pooler URL.

## Available Commands

### NPM Scripts

```bash
# Link to cloud project
npm run supabase:link

# Check project status
npm run supabase:status

# Generate migration from schema diff
npm run supabase:db:diff

# Push migrations to cloud
npm run supabase:db:push

# Reset cloud database (⚠️ DESTRUCTIVE)
npm run supabase:db:reset

# Generate TypeScript types
npm run supabase:types

# Create new migration
npm run supabase:migration:new <name>

# Convenience aliases
npm run db:migrate   # Alias for supabase:db:push
npm run db:types     # Alias for supabase:types
```

### Direct CLI Commands

```bash
# Login to Supabase
npx supabase login

# Link to project
npx supabase link --project-ref yzrwkznkfisfpnwzbwfw

# Check status
npx supabase status

# Database operations
npx supabase db diff
npx supabase db push --linked
npx supabase db reset --linked
npx supabase migration new <name>
npx supabase migration list

# Type generation
npx supabase gen types typescript --linked > src/types/database.ts
```

## Troubleshooting

### "Cannot find project ref"

**Solution:** Link your project first:

```bash
npm run supabase:link
```

### "Access token expired"

**Solution:** Login again:

```bash
npx supabase login
```

### "Migration history mismatch"

**Solution:** Repair the migration:

```bash
npx supabase migration repair --status applied <migration-timestamp>
```

### "Types not updating"

**Solution:** Regenerate types:

```bash
npm run db:types
```

### "Database connection failed"

**Solution:** 
1. Check your `DATABASE_URL` in `.env`
2. Verify your database password is correct
3. Check if you're using the transaction pooler URL (recommended)
4. Ensure your IP is allowed in Supabase dashboard (if restrictions are enabled)

### "Migration failed"

**Solution:**
1. Check the error message in the terminal
2. Review the migration file for syntax errors
3. Check if the migration conflicts with existing schema
4. Verify you're connected to the correct project

## Project Details

- **Project Ref**: `yzrwkznkfisfpnwzbwfw`
- **Project Name**: `bizfintunestore`
- **Region**: Southeast Asia (Singapore)
- **Types Output**: `src/types/database.ts`
- **Migrations**: `supabase/migrations/`

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase TypeScript Types](https://supabase.com/docs/reference/cli/supabase-gen-types-typescript)
- [Transaction Pooler Documentation](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

## Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Use different projects** - Dev/staging/production
3. **Rotate keys regularly** - If keys are exposed
4. **Use RLS policies** - Row Level Security for data access
5. **Limit database access** - Only grant necessary permissions
6. **Monitor access logs** - Check Supabase dashboard regularly

## Next Steps

1. **Read the workflow** - Understand the daily development process
2. **Create your first migration** - Try adding a new table
3. **Generate types** - See how TypeScript types are generated
4. **Test the workflow** - Practice the complete development cycle
5. **Set up CI/CD** - Automate migrations and type generation

---

**Last Updated**: 2025-01-14  
**Project**: biz.finetune.store  
**Workflow**: Cloud-only (no Docker)

