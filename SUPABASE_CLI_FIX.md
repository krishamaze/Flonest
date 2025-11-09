# Supabase CLI Configuration Fix

## Problem
Supabase CLI was failing to connect with timeout errors when using the connection pooler.

## Solution
Configure CLI to use **direct database connection** (--skip-pooler) instead of pooler. This:
- ✅ Works without Docker
- ✅ Avoids connection timeout issues
- ✅ More reliable for migrations

## Permanent Fix Applied

### 1. Updated package.json Scripts
- `supabase:link` now uses helper script that includes `--skip-pooler` flag
- All migration commands use `--linked` flag (uses stored connection config)

### 2. Created Link Scripts
- `scripts/supabase-link.cjs` - Cross-platform Node.js script
- `scripts/supabase-link.ps1` - PowerShell script (Windows)
- `scripts/supabase-link.sh` - Bash script (Linux/Mac)

### 3. Updated Documentation
- `SUPABASE_CLI_SETUP.md` - Updated with direct connection instructions
- `docs/CLOUD_DEV_WORKFLOW.md` - Added --skip-pooler flag documentation

## How to Use

### First Time Setup

1. **Link the project** (one-time setup):
   ```bash
   npm run supabase:link
   ```
   This will prompt for your database password and link with `--skip-pooler` flag.

2. **Apply migrations**:
   ```bash
   npm run supabase:db:push
   ```

### Manual Linking (if needed)

If you need to re-link the project:

```bash
# Using the helper script (recommended)
npm run supabase:link

# Or manually with direct connection
npx supabase link --project-ref yzrwkznkfisfpnwzbwfw --skip-pooler --password YOUR_PASSWORD
```

### Environment Variable

You can set the password as an environment variable to avoid prompts:

```bash
# Windows PowerShell
$env:SUPABASE_DB_PASSWORD = "your-password"
npm run supabase:link

# Linux/Mac
export SUPABASE_DB_PASSWORD="your-password"
npm run supabase:link
```

## What Changed

### Before
- Used connection pooler (default)
- Connection timeouts
- Required Docker in some cases

### After
- Uses direct database connection (`--skip-pooler`)
- No connection timeouts
- No Docker required
- More reliable migrations

## Verification

After linking, verify the connection:

```bash
npx supabase migration list --linked
```

This should show your migrations without connection errors.

## Troubleshooting

### Still Getting Connection Errors?

1. **Check your password**: Make sure the database password is correct
2. **Check network**: Ensure you can reach Supabase servers
3. **Re-link**: Unlink and re-link the project:
   ```bash
   npx supabase unlink
   npm run supabase:link
   ```

### Connection Pooler vs Direct Connection

- **Pooler** (`aws-1-ap-southeast-1.pooler.supabase.com:5432`): Can timeout, requires specific network config
- **Direct** (`db.yzrwkznkfisfpnwzbwfw.supabase.co:5432`): More reliable, works without special config

We're now using **direct connection** permanently.

## Files Modified

1. `package.json` - Updated `supabase:link` script
2. `scripts/supabase-link.cjs` - New helper script
3. `scripts/supabase-link.ps1` - PowerShell helper
4. `scripts/supabase-link.sh` - Bash helper
5. `SUPABASE_CLI_SETUP.md` - Updated documentation
6. `docs/CLOUD_DEV_WORKFLOW.md` - Updated workflow docs
7. `supabase/.gitignore` - Added to ignore temp files

## Next Steps

1. Run `npm run supabase:link` to link with direct connection
2. Run `npm run supabase:db:push` to apply pending migrations
3. All future migrations will use direct connection automatically

