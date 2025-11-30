# ADR-0001: Cloud-Only Development (No Local Supabase)

**Date:** 2025-11-28
**Status:** Accepted
**Supersedes:** Previous local Supabase development approach

## Context

The Flonest project initially attempted to use local Supabase development via Docker for database operations. The goal was to provide developers with a local PostgreSQL instance for development and testing. However, this approach encountered several critical issues:

1. **Docker Complexity**: Running local Supabase required Docker Desktop, which introduced system resource overhead, version conflicts, and platform-specific issues (especially on Windows).

2. **Migration Sync Issues**: Keeping local database schema in sync with cloud (preview/production) branches proved challenging. Developers would apply migrations locally, then need to manually sync to cloud.

3. **Git Integration Friction**: Supabase's git-based migration system (where pushing to a linked git branch auto-applies migrations to the corresponding Supabase branch) conflicted with local-first workflows.

4. **Limited ROI**: The complexity of maintaining local Supabase did not justify the benefits for a small team working primarily on a single codebase.

5. **Network Availability**: With modern internet connectivity, developers rarely work completely offline for extended periods.

See [LOCAL_SUPABASE_POSTMORTEM.md](../LOCAL_SUPABASE_POSTMORTEM.md) for detailed analysis of the issues encountered.

## Decision

We will adopt a **cloud-only development model** using Supabase cloud branches:

1. **Development Branch**: `evbbdlzwfqhvcuojlahr` - Linked to `preview` git branch
2. **Production Branch**: `yzrwkznkfisfpnwzbwfw` - Linked to `main` git branch
3. **No Docker Required**: Remove all local Docker/Supabase setup requirements
4. **Git-Based Migrations**: All migrations applied via git push to linked branches
5. **Direct Cloud Access**: Developers work directly against Supabase cloud instances

### Migration Workflow

```bash
# Create migration
npm run supabase:migration:new add_new_feature

# Write SQL in supabase/migrations/[timestamp]_add_new_feature.sql

# Commit and push to preview
git add supabase/migrations/
git commit -m "migration: add new feature"
git push origin preview
# → Supabase auto-applies to preview branch

# Test on preview, then merge to main
git checkout main
git merge preview
git push origin main
# → Supabase auto-applies to production branch
```

### MCP Usage

Model Context Protocol (MCP) is used for **read/query/debug operations only**:

- ✅ Reading schema
- ✅ Querying data
- ✅ Debugging RLS policies
- ✅ Viewing logs
- ❌ Applying migrations (use git push instead)
- ❌ Running DDL (use migration files instead)

## Alternatives Considered

### Evolution to Branching 2.0
We have evolved this decision to adopt **Supabase Branching 2.0** (see ADR-0002). This provides:
- Isolated cloud environments for every branch
- Better integration with Vercel previews
- Native git-based workflow for database schema

### Alternative 1: Local PostgreSQL (No Supabase)
- **Pros**: Simpler than full Supabase stack, standard PostgreSQL
- **Cons**: Missing Supabase-specific features (auth, RLS, functions), still requires migration sync
- **Why rejected**: Loses value of Supabase platform features

## Consequences

### Positive

- **Simplified Setup**: No Docker installation or configuration required
- **Zero Sync Issues**: Single source of truth (cloud) eliminates local/cloud drift
- **Git Integration**: Seamless migration application via git push
- **Better Branch Isolation**: Preview and production branches clearly separated
- **Faster Onboarding**: New developers can start immediately with cloud credentials
- **Consistent Environment**: All developers work against identical infrastructure

### Negative

- **Network Dependency**: Requires internet connection for development
- **Slower Queries**: Network latency vs. local database (~50-200ms vs. <5ms)
- **Cloud Costs**: Development queries count toward Supabase usage (minimal impact with free tier)
- **No Offline Development**: Cannot work on database-dependent features without internet

### Neutral

- **Credential Management**: Developers need cloud credentials (already required for deployment)
- **Preview Branch Usage**: Developers share preview branch (requires coordination for conflicting migrations)

## Implementation Notes

### Setup Steps

1. Remove Docker/local Supabase references from documentation
2. Update `.env.example` with cloud branch credentials
3. Document preview vs. production branch usage
4. Update `GETTING_STARTED.md` to reflect cloud-only workflow
5. Archive `LOCAL_SUPABASE_POSTMORTEM.md` as historical reference

### Files Affected

- `.env.example` - Cloud credentials only
- `docs/GETTING_STARTED.md` - Removed Docker steps
- `docs/SUPABASE_CLI_SETUP.md` - Cloud linking instructions
- `docs/MCP_WORKFLOW.md` - MCP read-only usage
- `CLAUDE.md` - Updated development workflows section

### Migration Checklist

- [x] Remove local Supabase setup instructions
- [x] Document git-based migration workflow
- [x] Update environment variable examples
- [x] Test migration application on preview branch
- [x] Verify production branch migration process
- [x] Update onboarding documentation

## References

- [LOCAL_SUPABASE_POSTMORTEM.md](../LOCAL_SUPABASE_POSTMORTEM.md) - Detailed postmortem of local approach
- [MCP_WORKFLOW.md](../MCP_WORKFLOW.md) - MCP usage for cloud operations
- [SUPABASE_CLI_SETUP.md](../SUPABASE_CLI_SETUP.md) - Cloud linking setup
- [Supabase Git-Based Workflows](https://supabase.com/docs/guides/cli/managing-environments)

---

**Author**: Development Team
**Last Updated**: 2025-11-28
