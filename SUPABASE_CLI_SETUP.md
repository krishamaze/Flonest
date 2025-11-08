# Supabase CLI Setup & Usage

## Installation

The Supabase CLI is installed as a dev dependency in this project. This ensures version consistency across all team members and avoids global installation conflicts.

### Setup

```bash
# Install dependencies (includes Supabase CLI)
npm install

# Verify installation
npm run supabase:status
```

### Benefits

- ✅ **Version Pinned**: CLI version is locked in `package.json`
- ✅ **No Global Install**: No system-wide conflicts
- ✅ **Team Consistency**: Everyone uses the same CLI version
- ✅ **Easy Updates**: Update via `npm update supabase`

---

## ✅ Completed Setup

### 1. Project Linking
- **Status**: ✅ Linked to remote project
- **Project**: `bizfintunestore` (ref: `yzrwkznkfisfpnwzbwfw`)
- **Region**: Southeast Asia (Singapore)
- **Command Used**: `npx supabase link --project-ref yzrwkznkfisfpnwzbwfw`

### 2. TypeScript Types Generation
- **Status**: ✅ Generated from remote database
- **File**: `src/types/database.ts`
- **Command Used**: `npx supabase gen types typescript --linked` (or `npm run supabase:types`)
- **Tables Detected**:
  - `inventory` - Inventory items with product relationships
  - `master_products` - Product master data
  - `invoices` - Invoice records with GST fields
  - `invoice_items` - Invoice line items
  - `team_members` - User team memberships
  - `tenants` - Multi-tenant organization data

### 3. Configuration Fix
- **Issue**: Invalid `email_optional` field in `supabase/config.toml`
- **Status**: ✅ Fixed

### 4. Migration Status
- **Local Migration**: `20251105180355_remote_commit.sql`
- **Status**: Migration exists but needs repair
- **Note**: Use `npx supabase migration repair` if needed

---

## Useful Supabase CLI Commands

All commands use `npx supabase` to ensure the project's pinned version is used. You can also use the npm scripts defined in `package.json`.

### NPM Scripts (Recommended)

```bash
# Check Supabase status
npm run supabase:status

# Generate TypeScript types
npm run supabase:types

# Push migrations to remote
npm run supabase:push

# Create new migration (requires migration name)
npm run supabase:migration:new <migration-name>
```

### Project Management

```bash
# Link to remote project
npx supabase link --project-ref <project-ref>

# List all projects
npx supabase projects list

# Unlink project
npx supabase unlink

# Check link status
npx supabase status
```

### Database Operations

```bash
# Generate TypeScript types from remote database
npx supabase gen types typescript --linked > src/types/database.ts
# Or use: npm run supabase:types

# Pull remote database schema (requires Docker)
npx supabase db pull

# Push local migrations to remote
npx supabase db push
# Or use: npm run supabase:push

# Create new migration
npx supabase migration new <migration-name>
# Or use: npm run supabase:migration:new <migration-name>

# List migrations
npx supabase migration list

# Repair migration history
npx supabase migration repair --status applied <migration-timestamp>
```

### Database Inspection (Remote)

```bash
# Table statistics
npx supabase inspect db table-stats --linked

# Database statistics
npx supabase inspect db db-stats --linked

# Index statistics
npx supabase inspect db index-stats --linked

# Long-running queries
npx supabase inspect db long-running-queries --linked

# Blocking queries
npx supabase inspect db blocking --linked

# Query performance outliers
npx supabase inspect db outliers --linked
```

### Local Development (Requires Docker)

```bash
# Start local Supabase
npx supabase start

# Stop local Supabase
npx supabase stop

# Check local status
npx supabase status
# Or use: npm run supabase:status

# Reset local database
npx supabase db reset

# Seed local database
npx supabase db seed
```

### Edge Functions

```bash
# List functions
npx supabase functions list

# Deploy function
npx supabase functions deploy <function-name>

# Serve functions locally
npx supabase functions serve
```

### Storage

```bash
# List buckets
npx supabase storage ls

# Create bucket
npx supabase storage create <bucket-name>

# Upload file
npx supabase storage upload <bucket-name> <file-path>
```

---

## Current Database Schema

Based on generated types, your database includes:

### Tables

1. **inventory**
   - Stores inventory items with product relationships
   - Fields: `id`, `tenant_id`, `product_id`, `quantity`, `cost_price`, `selling_price`

2. **master_products**
   - Product master data
   - Fields: `id`, `tenant_id`, `name`, `sku`, `description`, `status`

3. **invoices**
   - Invoice records with GST support
   - Fields: `id`, `tenant_id`, `invoice_number`, `total_amount`, `cgst_amount`, `sgst_amount`, `status`

4. **invoice_items**
   - Invoice line items
   - Fields: `id`, `invoice_id`, `product_id`, `quantity`, `unit_price`, `line_total`

5. **team_members**
   - User team memberships and roles
   - Fields: `user_id`, `tenant_id`, `email`, `role`

6. **tenants**
   - Multi-tenant organizations
   - Fields: `id`, `name`, `slug`

---

## Workflow Recommendations

### Daily Development

1. **Start Local Development** (if using Docker):
   ```bash
   npx supabase start
   ```

2. **Generate Types After Schema Changes**:
   ```bash
   npm run supabase:types
   # Or: npx supabase gen types typescript --linked > src/types/database.ts
   ```

3. **Create Migrations for Schema Changes**:
   ```bash
   npm run supabase:migration:new add_product_fields
   # Edit migration file
   npm run supabase:push
   # Or: npx supabase db push
   ```

### Before Deployment

1. **Generate Latest Types**:
   ```bash
   npm run supabase:types
   # Or: npx supabase gen types typescript --linked > src/types/database.ts
   ```

2. **Check Migration Status**:
   ```bash
   npx supabase migration list
   ```

3. **Push Migrations** (if any):
   ```bash
   npm run supabase:push
   # Or: npx supabase db push
   ```

### Database Monitoring

```bash
# Check table sizes
npx supabase inspect db table-stats --linked

# Monitor query performance
npx supabase inspect db outliers --linked

# Check for blocking queries
npx supabase inspect db blocking --linked
```

---

## Troubleshooting

### Issue: "Cannot find project ref"
**Solution**: Link project first
```bash
npx supabase link --project-ref <your-project-ref>
```

### Issue: "Docker not running" (for local dev)
**Solution**: Install and start Docker Desktop, or use remote commands with `--linked` flag

### Issue: "Migration history mismatch"
**Solution**: Repair migration
```bash
npx supabase migration repair --status applied <migration-timestamp>
```

### Issue: "Types not updating"
**Solution**: Regenerate types
```bash
npm run supabase:types
# Or: npx supabase gen types typescript --linked > src/types/database.ts
```

### Issue: "Command not found: supabase"
**Solution**: Use `npx supabase` instead of `supabase`, or run `npm install` to install dependencies

---

## Next Steps

1. **Update TypeScript Types Regularly**:
   - Run `npm run supabase:types` after any schema changes
   - Commit updated types to git

2. **Create Migrations for New Features**:
   - Use `npm run supabase:migration:new <name>` for schema changes
   - Test locally (if Docker available) or push directly to remote

3. **Monitor Database Performance**:
   - Use `npx supabase inspect db` commands to monitor performance
   - Check for long-running queries and optimize

4. **Set Up CI/CD** (Optional):
   - Add type generation to build process
   - Automate migration checks

5. **Update CLI Version**:
   - Update via `npm update supabase`
   - Version is pinned in `package.json` under `devDependencies`

---

## CLI Version

- **Installation**: Installed via npm as dev dependency
- **Version**: See `package.json` → `devDependencies.supabase`
- **Update Command**: `npm update supabase`
- **No Global Install**: CLI is project-scoped, avoiding version conflicts

---

**Last Updated**: 2025-01-14  
**Project**: biz.finetune.store  
**Remote Project**: bizfintunestore (yzrwkznkfisfpnwzbwfw)  
**CLI Installation**: npm dev dependency (no global install required)

