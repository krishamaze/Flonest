# Local Supabase Setup - Post-Mortem Report

Date: 2025-11-26  
Project: Flonest  
Production Ref: yzrwkznkfisfpnwzbwfw  

## Executive Summary

Our local development environment was corrupted due to a combination of:
1. Outdated Supabase CLI binary (v2.54.11 vs v2.62.x)  
2. Stale Docker volumes with incompatible schema state  
3. Deleted migration files breaking the schema sync  
4. Misconfigured `.env.local` with placeholder keys  

***

## 1. What Was Broken

### 1.1 Missing Migration Files

We had deleted multiple critical assets:
- `supabase/migrations/00000000000000_baseline_schema.sql`  
- `supabase/migrations/20251116085509_profiles_auth_users_trigger.sql`  
- 45+ other migration files  
- `supabase/functions/admin-auto-confirm-email/index.ts`  
- `supabase/functions/gst-validate/index.ts`  
- Additional edge functions  

Impact: Local Supabase could not apply the schema, so the database would be empty or partially configured.

### 1.2 CLI Version Mismatch

| Component              | Our Version | Required |
|------------------------|------------|----------|
| `bin/supabase.exe`     | v2.54.11   | v2.62.x  |
| Docker images pulled   | v2.62.x    | -        |

Impact: The storage-api container failed with:

“Error: Migration iceberg-catalog-ids not found”

This happens when newer Docker images expect schema migrations that the older CLI does not provide.

### 1.3 Corrupted Docker Volumes

Docker volumes retained state from previous failed attempts:
- `supabase_config_Flonest`  
- `supabase_db_Flonest`  
- `supabase_storage_Flonest`  
- `supabase_edge_runtime_Flonest`  

Impact: Even after fixing files, the corrupted volume data caused startup failures.

### 1.4 Stale Container Names

Some containers still used legacy naming from a different project:
- `supabase_storage_biz.finetune.store`  
- `supabase_db_biz.finetune.store`  

This indicated we were sharing the same Docker environment between Flonest and `biz.finetune.store`, leading to conflicts.

***

## 2. Root Cause Analysis

### How It Happened

Timeline:
1. We had a working cloud setup (production: yzrwkznkfisfpnwzbwfw).  
2. We attempted to set up the local Docker environment.  
3. We made experimental changes on the `dev_db_testing` branch.  
4. We deleted migration files (accidentally or as part of experimentation).  
5. We created `.env.local` with placeholder keys.  
6. Multiple failed `supabase start` attempts left the Docker state corrupted.  
7. The old `bin/supabase.exe` could not work with the newer Docker images.

### Why the Storage Container Failed

Supabase Storage uses internal migrations stored in the Docker image.  
When the database has partial or stale storage schema from previous runs, the new storage-api image cannot find the expected migration state.  

Using CLI v2.54.11 while pulling v2.62.x images created a schema mismatch that caused a crash loop.

***

## 3. How We Fixed It

### Step 1: Restored Migration Files

We restored all deleted migrations and edge functions from `main`:

```powershell
git checkout main -- supabase/
```

### Step 2: Cleaned Docker State

We fully cleaned the Supabase-related containers and volumes:

```powershell
# Stop and remove all supabase containers
docker rm -f $(docker ps -aq --filter "name=supabase")

# Delete corrupted volumes
docker volume rm supabase_config_Flonest supabase_db_Flonest `
  supabase_edge_runtime_Flonest supabase_storage_Flonest
```

### Step 3: Used Updated CLI via npx

We stopped relying on the outdated `bin/supabase.exe` and instead ran:

```powershell
npx supabase start  # Uses v2.62.5 from npm
```

### Step 4: Fresh Start with Correct Keys

On `npx supabase start`, Supabase generated local keys, for example:

- Publishable key: `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`  
- Secret key: `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`  

These are local-only keys and work only for the Docker instance.

### Step 5: Updated .env.local

We replaced all placeholder values with the actual local Supabase keys so that the app pointed to the correct local instance.

***

## 4. What We Did Wrong

| Mistake                                  | Why It Is Problematic                             |
|------------------------------------------|---------------------------------------------------|
| Deleting migration files                  | Breaks schema sync between local and cloud        |
| Using stale `bin/supabase.exe`           | Version drift causes Docker image incompatibility |
| Not cleaning Docker volumes after errors | Corrupted state persists across restarts          |
| Mixing project containers                | Causes container name and state conflicts         |
| Committing untested experimental changes | Leads to build failures in CI/CD                  |
| Using placeholder keys in `.env.local`   | Causes silent runtime failures                    |

***

## 5. Future-Proofing Recommendations

### 5.1 Always Use npx for Supabase CLI

We should standardize on:

```powershell
npx supabase start
npx supabase db diff
npx supabase db push
```

If we insist on a binary, we must update it regularly:

```powershell
curl.exe -L -o .\bin\supabase.exe https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe
```

### 5.2 Add npm Scripts

We should wire convenience scripts into `package.json`:

```json
{
  "scripts": {
    "supabase:start": "npx supabase start",
    "supabase:stop": "npx supabase stop",
    "supabase:reset": "npx supabase db reset",
    "supabase:status": "npx supabase status"
  }
}
```

### 5.3 Clean Reset Procedure

When local Supabase breaks, we should run a predictable reset:

```powershell
npx supabase stop
docker rm -f $(docker ps -aq --filter "name=supabase")
docker volume ls --filter label=com.supabase.cli.project=Flonest -q | ForEach-Object { docker volume rm $_ }
npx supabase start
```

### 5.4 Branch Protection

We should never delete migration files on shared branches. For experiments:

```powershell
git checkout -b experiment/local-db
# experiment here
git checkout main
git branch -D experiment/local-db
```

If the experiment works, we merge; if not, we discard the branch without touching main migrations.

### 5.5 Environment File Management

| File                 | Purpose                 | Git Status   |
|----------------------|------------------------|-------------|
| `.env`               | Production/cloud config | Committed (no secrets) |
| `.env.local`         | Local Docker overrides  | Gitignored   |
| `.env.local.example` | Template for local setup| Committed    |

***

## 6. Security Assessment

### Current State: Secure

| Aspect                     | Status                                   |
|----------------------------|------------------------------------------|
| Production keys exposed    | No; only local keys are used             |
| Local keys in git          | No; `.env.local` is gitignored           |
| Service key exposure       | Local-only service key                   |
| Production project-ref use | Linked only as identifier, no creds      |

### Local Keys Are Safe

The keys:

- `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`  
- `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`  

are deterministically generated for local Supabase Docker and do not work against the production instance.

***

## 7. Current Working State

We have now confirmed:

- Local Supabase is running (`npx supabase` v2.62.5).  
- All migrations are in sync with production.  
- Test users exist:  
  - `internal@test.com` / `password` (Platform Admin)  
  - `owner@test.com` / `password` (Org Owner)  
- `.env.local` is configured correctly.  
- Branch `flonest_branding` is pushed with build fixes.

### Services Available

| Service   | URL                                                       |
|-----------|-----------------------------------------------------------|
| API       | http://127.0.0.1:54321                                   |
| Studio    | http://127.0.0.1:54323                                   |
| Mailpit   | http://127.0.0.1:54324                                   |
| Database  | postgresql://postgres:postgres@127.0.0.1:54322/postgres  |

***

## 8. Commands Cheat Sheet

```powershell
# Start local environment
npx supabase start

# Check status
npx supabase status

# Reset database (applies all migrations fresh)
npx supabase db reset

# Stop local environment
npx supabase stop

# View logs
docker logs supabase_db_Flonest -f

# Full cleanup (when things break)
npx supabase stop
docker rm -f $(docker ps -aq --filter "name=supabase")
docker volume rm $(docker volume ls -q --filter label=com.supabase.cli.project=Flonest)
npx supabase start
```