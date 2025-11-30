# Cloud-Only Development Workflow

Complete guide for Supabase Branching 2.0 development workflow.

## Overview

This project uses **Supabase Branching 2.0** for a modern, cloud-native development workflow:
- ✅ **Cloud Branches** - dedicated database environments for each feature
- ✅ **Vercel Preview** - automatic preview deployments for every branch
- ✅ **Git Integration** - database schema changes synchronized with git branches
- ✅ **Migrations are source of truth** - All schema changes via migrations

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

### 2. Set Environment Variables

Create `.env` file with:

```env
# App Runtime (Frontend)
VITE_SUPABASE_URL=https://yzrwkznkfisfpnwzbwfw.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# CLI Authentication
SUPABASE_ACCESS_TOKEN=your-access-token-here
SUPABASE_DB_PASSWORD=your-database-password-here
```

**Get these from:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard → Project Settings → API
- `SUPABASE_ACCESS_TOKEN`: Automatically stored after `npx supabase login`
- `SUPABASE_DB_PASSWORD`: Supabase Dashboard → Project Settings → Database

### 3. Link to Cloud Project

```bash
npm run supabase:link
```

This links your local project to the cloud Supabase project using direct connection.

### 4. Apply Migrations

```bash
npm run supabase:db:push
```

## Daily Workflow

### Create Migration

```bash
npm run supabase:migration:new <migration-name>
```

Edit the migration file in `supabase/migrations/`.

### Apply Migration

```bash
npm run supabase:db:push
```

### Generate TypeScript Types

```bash
npm run supabase:types
```

## Commands Reference

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

## Troubleshooting

### Connection Issues

The CLI uses direct connection (--skip-pooler) to avoid timeout issues. If you experience problems:

1. Check your network connection
2. Verify `SUPABASE_DB_PASSWORD` is correct in `.env`
3. Verify `SUPABASE_ACCESS_TOKEN` is set (run `npx supabase login`)
4. Try unlink and re-link: `npx supabase unlink && npm run supabase:link`

### Missing Environment Variables

If you see errors about missing environment variables:

1. Check your `.env` file exists
2. Ensure all required variables are set (see Setup section)
3. Restart your terminal/IDE after adding variables
