# Supabase CLI Setup

## Quick Start

### 1. Login to Supabase CLI

```bash
npx supabase login
```

This opens your browser to authenticate and stores your access token.

### 2. Set Environment Variables

Add these to your `.env` file:

```env
# CLI Authentication (from npx supabase login)
SUPABASE_ACCESS_TOKEN=your-access-token-here

# Database password for CLI operations
SUPABASE_DB_PASSWORD=your-database-password-here
```

**Get these from:**
- `SUPABASE_ACCESS_TOKEN`: Automatically stored after `npx supabase login`
- `SUPABASE_DB_PASSWORD`: Supabase Dashboard → Project Settings → Database

### 3. Link Project

```bash
npm run supabase:link
```

This links your local project to the cloud Supabase project using direct connection (no Docker required).

### 4. Apply Migrations

```bash
npm run supabase:db:push
```

## Available Commands

```bash
# Link to cloud project
npm run supabase:link

# Check status
npm run supabase:status

# Push migrations
npm run supabase:db:push

# Generate TypeScript types
npm run supabase:types

# Create new migration
npm run supabase:migration:new <name>
```

## Project Details

- **Project Ref**: `yzrwkznkfisfpnwzbwfw`
- **Connection**: Direct connection (--skip-pooler) - No Docker required
- **Migrations**: Stored in `supabase/migrations/`

## Troubleshooting

### Missing Environment Variables

If you see "Missing required environment variables":
1. Check your `.env` file exists
2. Ensure `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` are set
3. Run `npx supabase login` if access token is missing

### Connection Timeout

The CLI uses direct connection (--skip-pooler) to avoid timeout issues. If you still experience problems:
1. Check your network connection
2. Verify database password is correct
3. Try unlink and re-link: `npx supabase unlink && npm run supabase:link`
