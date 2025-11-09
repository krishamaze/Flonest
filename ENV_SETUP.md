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
# Optional: Direct Database Access (Only if needed)
# =============================================================================
# DATABASE_URL=postgresql://postgres:password@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres
# DATABASE_DIRECT_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## Summary

### ✅ Keep in .env:
- `VITE_SUPABASE_URL` - Required for app
- `VITE_SUPABASE_ANON_KEY` - Required for app
- `SUPABASE_DB_PASSWORD` - Required for CLI
- `SUPABASE_ACCESS_TOKEN` - Required for CLI

### ⚠️ Optional (Remove if not needed):
- `DATABASE_URL` - Only if you use direct DB access tools
- `DATABASE_DIRECT_URL` - Only if you use connection pooler

**The CLI uses `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` directly, so `DATABASE_URL` and `DATABASE_DIRECT_URL` are not needed for migrations or linking.**

