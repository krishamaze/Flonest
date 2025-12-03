# ADR-0004: Git-Based Database Migrations

**Date:** 2025-11-28
**Status:** Accepted

## Context

Database schema changes are critical operations that require careful coordination between code, database state, and deployment. The Flonest project uses Supabase for backend infrastructure, which provides multiple ways to apply database migrations:

1. **`supabase db push`** - Direct push from local migrations to cloud
2. **Git-based migrations** - Auto-apply migrations when pushed to linked git branches
3. **MCP `apply_migration`** - Apply via Model Context Protocol
4. **SQL Editor** - Manual execution via Supabase dashboard

Each approach has different implications for:
- **Version Control**: Is the migration tracked in git history?
- **Deployment Automation**: Does it integrate with CI/CD?
- **Collaboration**: Can multiple developers coordinate safely?
- **Rollback**: Can we revert migrations easily?
- **Audit Trail**: Can we trace when and why migrations were applied?

The initial development workflow used a mix of `supabase db push` and MCP, which caused:
- **Lost git history** for some migrations
- **Out-of-sync state** between git and database
- **Confusion** about which method to use
- **No clear deployment flow** from preview to production

## Decision

We will adopt **git-based migrations as the exclusive method** for applying database schema changes:

### Core Principles

1. **Git is Source of Truth**: All migrations MUST be committed to git before application
2. **Automatic Application**: Migrations auto-apply when pushed to linked git branches
3. **No Manual Push**: Never use `supabase db push` or MCP to apply migrations
4. **Branch Linking**: Supabase branches linked to git branches

### Branch Mapping

```
Git Branch        →  Supabase Branch ID         →  Environment
────────────────────────────────────────────────────────────────
preview           →  evbbdlzwfqhvcuojlahr        →  Development
main              →  yzrwkznkfisfpnwzbwfw        →  Production
```

### Workflow

**Critical Rules:**
1. ❌ NEVER use `supabase migration new` - create files manually
2. ✅ Files must follow format: `YYYYMMDDHHMMSS_description.sql`
3. ✅ Write idempotent SQL that handles "already exists" gracefully

```bash
# 1. Get timestamp (PowerShell)
Get-Date -Format "yyyyMMddHHmmss"

# 2. Create migration file manually
# supabase/migrations/YYYYMMDDHHMMSS_add_new_feature.sql
# Example: supabase/migrations/20251203151330_add_new_feature.sql

# 3. Write idempotent SQL
# Use: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, etc.
# Example: ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT false;

# 4. Commit to git
git add supabase/migrations/
git commit -m "migration: add is_featured to products"

# 5. Push to preview branch
git push origin preview
# → Supabase automatically applies migration to preview branch

# 6. Test on preview environment
# Verify schema change: https://supabase.com/dashboard/project/evbbdlzwfqhvcuojlahr

# 7. Merge to main for production
git checkout main
git merge preview
git push origin main
# → Supabase automatically applies migration to production branch

# 8. Generate TypeScript types (after migration applied)
npm run supabase:types
git add src/types/database.ts
git commit -m "chore: update database types"
git push origin main
```

### MCP Role

MCP is used for **read/query/debug operations only**:

| Operation | Use MCP? | Use Git? |
|-----------|----------|----------|
| Apply migration | ❌ No | ✅ Yes |
| Read schema | ✅ Yes | N/A |
| Query data | ✅ Yes | N/A |
| Debug RLS | ✅ Yes | N/A |
| List migrations | ✅ Yes | N/A |
| View logs | ✅ Yes | N/A |

## Alternatives Considered

### Alternative 1: supabase db push
- **Pros**: Immediate application, simple CLI command
- **Cons**: Bypasses git history, no automatic deployment flow, manual coordination required
- **Why rejected**: Breaks git-as-source-of-truth principle

### Alternative 2: MCP apply_migration
- **Pros**: AI assistant can apply migrations, faster feedback loop
- **Cons**: Same issues as `db push` - bypasses git history
- **Why rejected**: Violates version control best practices

### Alternative 3: SQL Editor (Manual)
- **Pros**: Quick for debugging, visual interface
- **Cons**: No version control, no repeatability, error-prone
- **Why rejected**: Not suitable for production workflows

### Alternative 4: Dual Mode (Git + Manual)
- **Pros**: Flexibility to choose based on context
- **Cons**: Confusion about which method to use, inconsistent state
- **Why rejected**: Leads to drift between git and database

## Consequences

### Positive

- **Git as Source of Truth**: All migrations tracked in version control
- **Audit Trail**: Full history of schema changes with commit messages
- **Automatic Deployment**: Push to git triggers migration (no manual steps)
- **Safe Rollback**: Can revert git commit to undo migration (with care)
- **Collaboration**: Multiple developers coordinate via git (PRs, branches)
- **Environment Parity**: Preview and production follow same migration path
- **CI/CD Integration**: Fits naturally into deployment pipeline
- **No State Drift**: Database state always matches git history

### Negative

- **Slower Feedback**: Must push to git and wait for auto-apply (~30-60s)
- **Network Dependency**: Requires push to remote git repository
- **Less Direct Control**: Cannot manually apply migrations on demand
- **Preview Branch Sharing**: Multiple developers share preview branch (requires coordination)
- **Rollback Complexity**: Reverting migrations requires new "down" migration (cannot just delete migration file)

### Neutral

- **Learning Curve**: Developers must understand git-based flow
- **Supabase Dependency**: Reliant on Supabase's git integration working correctly

## Implementation Notes

### Critical Rules

**NEVER:**
- ❌ Run `supabase db push` for migrations
- ❌ Use MCP to apply migrations
- ❌ Execute migrations manually via SQL Editor (except emergencies)
- ❌ Delete migration files after they've been applied

**ALWAYS:**
- ✅ Commit migration files to git before pushing
- ✅ Push to preview branch first for testing
- ✅ Merge preview → main for production deployment
- ✅ Generate types after migration is applied
- ✅ Use descriptive commit messages (e.g., "migration: add feature X")

### Error Handling

If migration fails to apply:

```bash
# 1. Check Supabase dashboard logs
# In Cursor: "Show Supabase logs"

# 2. Fix the migration SQL
# Edit the migration file

# 3. Commit the fix
git add supabase/migrations/[filename].sql
git commit -m "fix: correct migration syntax"

# 4. Push again
git push origin preview
```

### Emergency Rollback

If a migration causes production issues:

```bash
# DO NOT delete the migration file
# Instead, create a new "down" migration

# Get timestamp
Get-Date -Format "yyyyMMddHHmmss"

# Create rollback migration manually
# Example: supabase/migrations/20251203152000_revert_feature_x.sql

# Write SQL to undo the change
# Example: ALTER TABLE products DROP COLUMN is_featured;

git add supabase/migrations/
git commit -m "migration: revert feature X due to issue Y"
git push origin main
```

### Files Affected

- `supabase/migrations/*.sql` - All migration files
- `.cursorrules` - Added strict rules against manual push
- `CLAUDE.md` - Updated development workflows section
- `docs/MCP_WORKFLOW.md` - Clarified MCP read-only usage
- `docs/SCHEMA_MIGRATION_WORKFLOW.md` - Updated with git-based flow

## References

- [Supabase Git-Based Workflows](https://supabase.com/docs/guides/cli/managing-environments)
- [SCHEMA_MIGRATION_WORKFLOW.md](../SCHEMA_MIGRATION_WORKFLOW.md) - Detailed workflow guide
- [MCP_WORKFLOW.md](../MCP_WORKFLOW.md) - MCP usage guidelines
- [ADR-0001: Cloud-Only Development](./0001-cloud-only-development.md) - Related decision

---

**Author**: Development Team
**Last Updated**: 2025-11-28
