# Supabase CLI Setup & Usage

## ✅ Completed Setup

### 1. Project Linking
- **Status**: ✅ Linked to remote project
- **Project**: `bizfintunestore` (ref: `yzrwkznkfisfpnwzbwfw`)
- **Region**: Southeast Asia (Singapore)
- **Command Used**: `supabase link --project-ref yzrwkznkfisfpnwzbwfw`

### 2. TypeScript Types Generation
- **Status**: ✅ Generated from remote database
- **File**: `src/types/database.ts`
- **Command Used**: `supabase gen types typescript --linked`
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
- **Note**: Use `supabase migration repair` if needed

---

## Useful Supabase CLI Commands

### Project Management

```bash
# Link to remote project
supabase link --project-ref <project-ref>

# List all projects
supabase projects list

# Unlink project
supabase unlink

# Check link status
supabase status
```

### Database Operations

```bash
# Generate TypeScript types from remote database
supabase gen types typescript --linked > src/types/database.ts

# Pull remote database schema (requires Docker)
supabase db pull

# Push local migrations to remote
supabase db push

# Create new migration
supabase migration new <migration-name>

# List migrations
supabase migration list

# Repair migration history
supabase migration repair --status applied <migration-timestamp>
```

### Database Inspection (Remote)

```bash
# Table statistics
supabase inspect db table-stats --linked

# Database statistics
supabase inspect db db-stats --linked

# Index statistics
supabase inspect db index-stats --linked

# Long-running queries
supabase inspect db long-running-queries --linked

# Blocking queries
supabase inspect db blocking --linked

# Query performance outliers
supabase inspect db outliers --linked
```

### Local Development (Requires Docker)

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Check local status
supabase status

# Reset local database
supabase db reset

# Seed local database
supabase db seed
```

### Edge Functions

```bash
# List functions
supabase functions list

# Deploy function
supabase functions deploy <function-name>

# Serve functions locally
supabase functions serve
```

### Storage

```bash
# List buckets
supabase storage ls

# Create bucket
supabase storage create <bucket-name>

# Upload file
supabase storage upload <bucket-name> <file-path>
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
   supabase start
   ```

2. **Generate Types After Schema Changes**:
   ```bash
   supabase gen types typescript --linked > src/types/database.ts
   ```

3. **Create Migrations for Schema Changes**:
   ```bash
   supabase migration new add_product_fields
   # Edit migration file
   supabase db push
   ```

### Before Deployment

1. **Generate Latest Types**:
   ```bash
   supabase gen types typescript --linked > src/types/database.ts
   ```

2. **Check Migration Status**:
   ```bash
   supabase migration list
   ```

3. **Push Migrations** (if any):
   ```bash
   supabase db push
   ```

### Database Monitoring

```bash
# Check table sizes
supabase inspect db table-stats --linked

# Monitor query performance
supabase inspect db outliers --linked

# Check for blocking queries
supabase inspect db blocking --linked
```

---

## Troubleshooting

### Issue: "Cannot find project ref"
**Solution**: Link project first
```bash
supabase link --project-ref <your-project-ref>
```

### Issue: "Docker not running" (for local dev)
**Solution**: Install and start Docker Desktop, or use remote commands with `--linked` flag

### Issue: "Migration history mismatch"
**Solution**: Repair migration
```bash
supabase migration repair --status applied <migration-timestamp>
```

### Issue: Types not updating
**Solution**: Regenerate types
```bash
supabase gen types typescript --linked > src/types/database.ts
```

---

## Next Steps

1. **Update TypeScript Types Regularly**:
   - Run `supabase gen types typescript --linked` after any schema changes
   - Commit updated types to git

2. **Create Migrations for New Features**:
   - Use `supabase migration new` for schema changes
   - Test locally (if Docker available) or push directly to remote

3. **Monitor Database Performance**:
   - Use `supabase inspect db` commands to monitor performance
   - Check for long-running queries and optimize

4. **Set Up CI/CD** (Optional):
   - Add type generation to build process
   - Automate migration checks

---

## CLI Version

- **Current**: v2.48.3
- **Latest Available**: v2.54.11
- **Update Command**: Follow [Supabase CLI update guide](https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli)

---

**Last Updated**: 2025-01-11  
**Project**: biz.finetune.store  
**Remote Project**: bizfintunestore (yzrwkznkfisfpnwzbwfw)

