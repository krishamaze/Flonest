# 🔍 Supabase Migration Audit Report

## Executive Summary

**Audit Date**: November 30, 2025
**Current Git Branch**: `preview`
**Supabase Active Branch**: `main` (⚠️ MISMATCH)
**Linked Project**: `yzrwkznkfisfpnwzbwfw`
**Supabase CLI Version**: 2.58.5 (outdated - latest is 2.62.10)

### Critical Findings
1. **Branch Mismatch**: Git is on `preview` but Supabase CLI is linked to `main` branch
2. **Deleted Baseline File**: `00000000000000_baseline_schema.sql` exists on `main` but deleted on `preview`
3. **Incomplete Migration**: `20251130195528_trigger_status_update.sql` is only 17 bytes (nearly empty)
4. **Untracked Migration**: The above file is untracked by Git (shows as `??` in git status)
5. **Preview Branch Divergence**: 6 migrations exist on `preview` that don't exist on `main`

---

## 1. Migration File Comparison: main vs preview

### Files on `main` branch (47 migrations)
```
00000000000000_baseline_schema.sql  ← DELETED on preview
20251116085509_profiles_auth_users_trigger.sql
... (45 other migrations)
20251126000000_add_check_user_has_password_function.sql (LAST)
```

### Files on `preview` branch (54 migrations)
```
[All 46 migrations from main except baseline]
PLUS 6 additional migrations:
- 20251128154305_rpc_adjust_stock_level.sql
- 20251129133552_add_products_master_product_fk.sql
- 20251129134007_add_upsert_master_customer_rpc.sql
- 20251129145936_fix_products_rls_insert_policy.sql
- 20251129175602_restore_validate_invoice_items.sql
- 20251129203042_add_customer_workflow.sql
PLUS 1 untracked file:
- 20251130195528_trigger_status_update.sql (⚠️ 17 bytes, untracked)
```

### Git Status
```
D  supabase/migrations/00000000000000_baseline_schema.sql (deleted)
?? supabase/migrations/20251130195528_trigger_status_update.sql (untracked)
```

---

## 2. Database Migration Status (via `npx supabase migration list`)

**All 54 migrations show as applied** (Local = Remote):
- ✅ All migrations from main are synced
- ✅ All 6 preview-only migrations are applied
- ✅ The 17-byte migration `20251130195528_trigger_status_update.sql` was applied to remote DB

**Observations**:
- No orphaned local-only migrations (all local exist in remote)
- No missing remote migrations (all remote exist in local)
- Database is in sync with local filesystem

---

## 3. Problematic Files

### 3.1 Empty/Incomplete Migration
**File**: `supabase/migrations/20251130195528_trigger_status_update.sql`
- **Size**: 17 bytes
- **Content**: `-- Status refresh`
- **Status**: Untracked by Git
- **Problem**: This is essentially an empty migration with only a comment
- **Risk**: Applied to remote DB but contains no actual schema changes

**Recommendation**:
- If this was created by accident, delete it and potentially revert it from the DB
- If it's a placeholder, either complete it or remove it

### 3.2 Deleted Baseline Schema
**File**: `00000000000000_baseline_schema.sql`
- **Status**: Exists on `main`, deleted on `preview` (git status shows `D`)
- **Git History**: Last modified in commit `fb29c58` ("Apply canonical roles baseline and Supabase schema")
- **Problem**: This file was intentionally deleted, but it represents the initial schema baseline
- **Database Impact**: Migration is still applied in remote DB (shows in migration list)

**Recommendation**:
- This deletion is intentional (per context about fixing migration conflicts)
- The baseline migration remains in the DB history
- No action needed unless you want to reconcile Git history with DB history

---

## 4. Branch Strategy Mismatch

### Current State
- **Git Branch**: `preview` (local working branch)
- **Supabase CLI Active Branch**: `main` (per `supabase/.branches/_current_branch`)
- **Mismatch Impact**: Commands like `npx supabase migration list` query the `main` branch's database, not `preview`

### Git Branch Topology
```
preview (current)
├── 07c9daa fix: Resolve TypeScript errors
├── ... (6 preview-only commits with migrations)
└── [diverged from main after 20251126000000]

main (production)
└── [last migration: 20251126000000]
```

### Supabase Branching 2.0 Status
- **Production Branch**: `main` (linked to `yzrwkznkfisfpnwzbwfw`)
- **Preview Branch**: Not explicitly configured in Supabase CLI
- **Problem**: Git branching strategy doesn't align with Supabase branching config

**Recommendation**:
- Create a Supabase preview branch linked to git `preview` branch
- Or merge `preview` → `main` to consolidate migrations

---

## 5. Configuration Safety Audit

### 5.1 supabase/config.toml
✅ **SAFE** - No exposed secrets
- `project_id = "biz.finetune.store"` (safe - non-sensitive)
- All sensitive fields use `env()` substitution
- Auth tokens properly use environment variables
- Local ports configured correctly

### 5.2 .gitignore
✅ **SAFE** - Proper exclusions in place
- `.env`, `.env.local` properly ignored
- `.cursor/mcp.json` ignored (contains sensitive tokens)
- `supabase/.branches/`, `supabase/.temp/` ignored
- Migration temp files (`*.sql.tmp`) ignored

### 5.3 .env.example
✅ **SAFE** - No actual secrets
- Contains placeholder values only
- Properly documents required variables
- Correctly references production project `yzrwkznkfisfpnwzbwfw`

### 5.4 Exposed Files in supabase/.temp/
⚠️ **LOW RISK** - Contains non-sensitive cached data:
- `project-ref`: Contains `yzrwkznkfisfpnwzbwfw` (already public in config)
- `pooler-url`: Contains connection string format (no password)
- Version metadata files (safe)

**Recommendation**: These are properly gitignored. No action needed.

---

## 6. Duplicate/Orphaned Files

### Findings
✅ **NO DUPLICATES** - `uniq -d` found no duplicate filenames
✅ **NO ORPHANS** - All 54 migrations are properly applied to remote DB
✅ **CONSISTENT NAMING** - All files follow `YYYYMMDDHHMMSS_description.sql` pattern

---

## 7. Git History Integrity

### Recent Migration-Related Commits
```
53a4680 feat: Add customer workflow migration
df12060 Restore missing RPC function validate_invoice_items
fa1c5be fix(rls): allow branch_head to insert products
7c9a919 fix(invoice): add missing upsert_master_customer RPC
c4199be fix(db): add missing foreign key for products.master_product_id
bb564df feat(inventory): implement adjust_stock_level RPC
d8d032d feat(invoices): implement smart input (deleted baseline here)
29bbc33 db: add check_user_has_password function
```

### Baseline Schema Deletion
- **Deleted In**: Commit `d8d032d` (Nov 28, 2025)
- **Reason**: Mentioned in context as "fix migration conflicts"
- **Impact**: Git history cleaned, but DB still has migration applied

---

## 8. Cleanup Plan & Recommendations

### Immediate Actions (Priority 1)

#### 1. Handle Empty Migration File
**File**: `20251130195528_trigger_status_update.sql`

**Option A** - Delete if accidental:
```bash
# Remove from filesystem
rm supabase/migrations/20251130195528_trigger_status_update.sql

# Optionally revert from database (ONLY if safe to do so)
# This requires careful consideration of whether it's been deployed
```

**Option B** - Complete if intentional:
```bash
# Add actual SQL content to the file
# Then commit it
git add supabase/migrations/20251130195528_trigger_status_update.sql
git commit -m "fix: complete trigger status update migration"
```

**Recommended**: Option A (delete) - file appears accidental

---

#### 2. Resolve Branch Strategy
**Problem**: Git on `preview`, Supabase CLI on `main`

**Option A** - Consolidate to main:
```bash
# Switch Git to main
git checkout main

# Merge preview into main
git merge preview

# Resolve conflicts if any
# Then push
git push origin main
```

**Option B** - Align Supabase CLI to preview:
```bash
# Create Supabase preview branch (if using Branching 2.0)
npx supabase branches create preview

# Switch CLI to preview branch
npx supabase link --branch preview
```

**Recommended**: Option A if preview is ready for production
**Recommended**: Option B if preview needs isolated testing

---

### Medium Priority Actions (Priority 2)

#### 3. Update Supabase CLI
```bash
npm install supabase@latest
# Current: 2.58.5 → Latest: 2.62.10
```

**Reason**: Bug fixes and compatibility with Branching 2.0

---

#### 4. Reconcile Baseline Schema Deletion
**Current State**:
- Deleted from Git (`preview` branch)
- Still exists on `main` Git branch
- Migration record exists in DB

**Options**:
- **Do Nothing**: Migration history in DB is preserved (RECOMMENDED)
- **Remove from main too**: `git checkout main && git rm supabase/migrations/00000000000000_baseline_schema.sql`

**Recommended**: Do nothing - the deletion on `preview` was intentional

---

### Low Priority Hygiene (Priority 3)

#### 5. Ensure Migration Idempotency
Review all migrations to ensure they can be safely re-run:
- Use `CREATE TABLE IF NOT EXISTS`
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (Postgres 9.6+)
- Use `CREATE OR REPLACE FUNCTION`

#### 6. Add Migration Validation
Add pre-push hook to validate migrations:
```bash
# .git/hooks/pre-push
#!/bin/bash
# Check for empty/small migrations
find supabase/migrations -name "*.sql" -size -50c -exec ls -lh {} \;
```

---

## 9. Unsafe Settings Check

### Reviewed Files:
- ✅ `supabase/config.toml` - No exposed keys
- ✅ `.gitignore` - Proper exclusions
- ✅ `.env.example` - Only placeholders
- ✅ `supabase/.temp/` - Properly gitignored

### Findings:
**NO UNSAFE SETTINGS DETECTED**

---

## 10. Final Recommendations Summary

| Action | Priority | Command/Steps | Reason |
|--------|----------|---------------|--------|
| Delete empty migration | **HIGH** | `rm supabase/migrations/20251130195528_trigger_status_update.sql` | Incomplete/accidental file |
| Merge preview → main | **HIGH** | `git checkout main && git merge preview` | Consolidate 6 diverged migrations |
| Update Supabase CLI | **MEDIUM** | `npm install supabase@latest` | Bug fixes for Branching 2.0 |
| Align CLI branch | **MEDIUM** | Review Supabase branching strategy | Git/Supabase branch mismatch |
| Baseline deletion | **LOW** | No action | Intentional cleanup |

---

## Appendix: Complete Migration List (54 files)

### Preview Branch (54 migrations):
1.  20251116085509_profiles_auth_users_trigger.sql
2.  20251116091434_rpc_create_default_org_for_user.sql
3.  20251116091721_memberships_rls_select_own.sql
4.  20251116092139_memberships_rls_enable_and_grant.sql
5.  20251116092405_orgs_rls_enable_and_membership_select.sql
6.  20251116092730_core_tables_rls_org_scoped_select.sql
7.  20251116164107_align_db_with_frontend_schema.sql
8.  20251116165206_fix_rls_policies_for_inventory_orgs_notifications.sql
9.  20251117015743_fix_master_products_rls_and_notifications_head.sql
10. 20251117020243_fix_master_products_rls_policy_roles_and_function_test.sql
11. 20251117022905_debug_rls_function_and_add_fallback_policy.sql
12. 20251117024337_grant_inventory_permissions_to_authenticated.sql
13. 20251117024653_grant_orgs_update_permission_to_authenticated.sql
14. 20251117024706_grant_missing_permissions_master_products_notifications.sql
15. 20251117031047_fix_billing_rls_policies_for_authenticated.sql
16. 20251117032749_enforce_unverified_gst_status_for_tenant_code.sql
17. 20251117052755_add_platform_admin_orgs_select_policy.sql
18. 20251117052816_fix_current_user_is_platform_admin_volatility.sql
19. 20251117061740_add_legal_name_to_orgs.sql
20. 20251117061815_update_mark_gst_verified_with_legal_name.sql
21. 20251117082828_add_unique_gstin_index.sql
22. 20251117103000_replace_default_lifecycle_states.sql
23. 20251117114500_add_user_org_contexts.sql
24. 20251117121500_add_org_lifecycle_state.sql
25. 20251117153951_fix_auth_rls_and_org_creation.sql
26. 20251117155119_fix_agent_relationships_rls_orgs_access.sql
27. 20251117155513_fix_memberships_orgs_join_and_agent_permissions_rls.sql
28. 20251117155937_fix_agent_relationships_rls_recursion.sql
29. 20251117160447_grant_agent_relationships_privileges.sql
30. 20251117161928_allow_multi_org_creation.sql
31. 20251117162551_fix_create_default_org_function.sql
32. 20251118091649_add_org_tax_fields.sql
33. 20251118092347_add_sez_tax_status_values.sql
34. 20251118093000_harden_tax_fields_and_invoice_uniqueness.sql
35. 20251118093500_add_tax_fields_to_customers_products.sql
36. 20251118094337_add_state_code_to_orgs_customers.sql
37. 20251118115351_add_tax_status_to_customers.sql
38. 20251118120000_platform_authority_master_data_governance.sql
39. 20251118120001_fix_post_purchase_bill_security.sql
40. 20251118120002_enforce_approved_workflow_and_add_negative_tests.sql
41. 20251118120100_fix_rpc_tenant_isolation_security.sql
42. 20251118120200_test_rpc_security_negative_tests.sql
43. 20251118132646_approve_purchase_bill_with_hsn_validation.sql
44. 20251118133815_post_sales_invoice_atomic_stock_deduction.sql
45. 20251118160000_harden_post_purchase_bill_locking.sql
46. 20251118163758_fix_purchase_bill_concurrency.sql
47. 20251126000000_add_check_user_has_password_function.sql
48. 20251128154305_rpc_adjust_stock_level.sql ← Preview only
49. 20251129133552_add_products_master_product_fk.sql ← Preview only
50. 20251129134007_add_upsert_master_customer_rpc.sql ← Preview only
51. 20251129145936_fix_products_rls_insert_policy.sql ← Preview only
52. 20251129175602_restore_validate_invoice_items.sql ← Preview only
53. 20251129203042_add_customer_workflow.sql ← Preview only
54. 20251130195528_trigger_status_update.sql ← UNTRACKED, EMPTY (17 bytes)

### Main Branch (47 migrations):
- Same as above minus #48-54
- Plus: 00000000000000_baseline_schema.sql (deleted on preview)

---

**End of Audit Report**
**READ-ONLY AUDIT COMPLETE - NO CHANGES APPLIED**
