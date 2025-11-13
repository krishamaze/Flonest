# Team Hierarchy & Role Design - Phase 2

## Executive Summary

This document answers 28 critical design questions before implementing team hierarchy, roles, and access control. Based on the current codebase analysis, we have:
- **Current roles**: `owner`, `branch_head`, `staff`
- **Current structure**: Org → Branches → Memberships (with branch_id)
- **Current RLS**: Role-based policies with internal user exclusion
- **Current permissions**: Static permission map in `src/lib/permissions.ts`

---

## A. Role Structure Definition

### 1. What are the distinct role types we're supporting in this phase?

**Answer**: We will support **5 role types**:

1. **`owner`** (existing)
   - Org-level, no branch assignment
   - Full org-wide access
   - Can manage all branches, memberships, and settings

2. **`branch_head`** (existing)
   - Branch-level manager
   - Full branch access
   - Can manage staff in their branch

3. **`manager`** (NEW)
   - Branch-level with reporting to branch_head
   - Can have direct reports (staff/interns)
   - Limited branch access (subset of branch_head permissions)

4. **`staff`** (existing)
   - Branch-level worker
   - No direct reports
   - Limited permissions (invoice creation, customer management)

5. **`advisor`** (NEW)
   - Org-level or cross-branch read-only role
   - Analytics and reporting access
   - No write permissions except comments/notes

**Note**: `intern` is **NOT** included in Phase 2. It can be added later as a variant of `staff` with further restrictions.

---

### 2. Do roles have static permissions, or will they be configurable per organization?

**Answer**: **Static permissions** in Phase 2.

**Rationale**:
- Faster implementation
- Clearer security model
- Easier to audit
- Simpler RLS policies

**Future consideration**: Custom roles per org can be added in Phase 3 via a `role_permissions` table, but Phase 2 uses a static enum-based permission system.

**Implementation**: Extend `src/lib/permissions.ts` with new role permissions map.

---

### 3. Can a user hold multiple roles within the same org?

**Answer**: **NO** - One role per org per user.

**Current constraint**: `UNIQUE(profile_id, org_id)` in `memberships` table enforces single membership per user per org.

**Rationale**:
- Simpler data model
- Clearer access control
- Avoids permission conflicts
- Matches current architecture

**Alternative approach** (future): If multi-role is needed, we can introduce a `user_roles` junction table, but this adds complexity to RLS policies.

---

### 4. Should there be role inheritance (e.g., Manager inherits Member permissions)?

**Answer**: **NO explicit inheritance** - Permissions are role-specific and explicit.

**Rationale**:
- Clearer permission model
- Easier to audit
- Avoids confusion about "inherited" vs "explicit" permissions
- Matches current implementation pattern

**Implementation**: Each role has its own explicit permission set in `ROLE_PERMISSIONS` map. If roles share permissions, they're duplicated in the map (not inherited).

---

### 5. How are role names and scopes stored — static enum in schema or dynamic via config table?

**Answer**: **Static enum in schema** (CHECK constraint) + TypeScript type.

**Current pattern**:
```sql
role VARCHAR(20) CHECK (role IN ('owner', 'branch_head', 'staff'))
```

**Phase 2 extension**:
```sql
role VARCHAR(20) CHECK (role IN ('owner', 'branch_head', 'manager', 'staff', 'advisor'))
```

**TypeScript type**: `src/types/index.ts`
```typescript
export type UserRole = 'owner' | 'branch_head' | 'manager' | 'staff' | 'advisor'
```

**Rationale**:
- Type safety
- Database-level validation
- Consistent with current architecture
- Easier to query and filter

**Future consideration**: If custom roles are needed, we can migrate to a `roles` table with a `role_permissions` junction, but Phase 2 stays static.

---

## B. Hierarchy & Reporting Logic

### 6. Can managers have sub-managers or only direct team members?

**Answer**: **Managers can have direct team members only** (staff/interns). No nested managers.

**Hierarchy structure**:
```
Owner (org-wide)
  └─ Branch Head (branch-level)
      └─ Manager (branch-level, reports to branch_head)
          └─ Staff/Intern (branch-level, reports to manager)
```

**Rationale**:
- Simpler hierarchy
- Clearer reporting lines
- Easier to implement
- Matches common org structures

**Data model**: `reports_to` field in `memberships` table (nullable UUID referencing `profiles.id`).

---

### 7. Is hierarchy single-parent (strict tree) or multi-parent (graph)?

**Answer**: **Single-parent (strict tree)**.

**Constraints**:
- Each user (except owner) has exactly one `reports_to` (nullable for branch_heads who report to owner)
- No cycles allowed
- Owner has no `reports_to` (NULL)

**Rationale**:
- Simpler data model
- Clearer reporting structure
- Easier to query (no complex graph queries)
- Matches current branch-based structure

**Validation**: Database triggers or application-level validation to prevent cycles.

---

### 8. How do Advisors fit — parallel role with read-only access, or supervisory oversight across teams?

**Answer**: **Parallel role with org-level or cross-branch read-only access**.

**Advisor characteristics**:
- **Scope**: Org-level (no branch_id required) OR assigned to specific branches (multi-branch access)
- **Permissions**: Read-only analytics, reports, dashboards
- **No hierarchy**: Advisors don't have reports and don't report to anyone (or report to owner for coordination)
- **Use case**: External consultants, auditors, executives who need visibility without edit rights

**Data model**: 
- `memberships.branch_id` = NULL for org-level advisors
- OR introduce `advisor_branches` junction table for multi-branch advisors (Phase 2: org-level only, multi-branch in Phase 3)

**Rationale**:
- Clear separation of concerns
- Flexible visibility model
- Supports external stakeholders
- Read-only access reduces security risk

---

### 9. Should we support org-level vs. team-level boundaries (e.g., Advisor visible to entire org vs. specific teams)?

**Answer**: **Phase 2: Org-level only. Phase 3: Multi-branch support**.

**Phase 2 implementation**:
- Advisors: `branch_id = NULL` (org-wide access)
- All other roles: `branch_id IS NOT NULL` (branch-specific)

**Phase 3 enhancement**:
- Introduce `advisor_branch_access` junction table for multi-branch advisors
- RLS policy: Advisors can access data from branches they have access to

**Rationale**:
- Simpler Phase 2 implementation
- Most advisors need org-wide visibility anyway
- Multi-branch can be added later without breaking changes

---

### 10. What's the default visibility scope for each role (data, analytics, team activity)?

**Answer**: **Role-based visibility matrix**:

| Role | Data Scope | Analytics Scope | Team Activity |
|------|-----------|----------------|---------------|
| **Owner** | Org-wide (all branches) | Org-wide | All members |
| **Branch Head** | Own branch | Own branch | Branch members only |
| **Manager** | Own branch (filtered by team) | Own branch (filtered by team) | Direct reports only |
| **Staff** | Own branch (own data) | Own branch (own data) | None (no team view) |
| **Advisor** | Org-wide (read-only) | Org-wide (read-only) | All members (read-only) |

**Implementation**:
- RLS policies filter by `branch_id` and `reports_to` hierarchy
- Dashboard queries filter by role and scope
- Analytics queries aggregate by visible scope

---

## C. Data Modeling

### 11. How will you represent reporting relationships in the database?

**Answer**: **Add `reports_to` column to `memberships` table**.

**Schema change**:
```sql
ALTER TABLE memberships
  ADD COLUMN reports_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_memberships_reports_to ON memberships(reports_to);
```

**Constraints**:
- `reports_to` must reference a `profile_id` in the same `org_id`
- `reports_to` cannot reference self (prevent cycles)
- Owner: `reports_to = NULL`
- Branch Head: `reports_to = NULL` (reports to owner implicitly, but no FK)
- Manager: `reports_to = branch_head.profile_id`
- Staff: `reports_to = manager.profile_id` OR `branch_head.profile_id` (if no manager)
- Advisor: `reports_to = NULL` (no hierarchy)

**Rationale**:
- Simple single-column FK
- Easy to query direct reports: `WHERE reports_to = current_user_id`
- Easy to query manager: `JOIN memberships ON reports_to = profile_id`
- Supports hierarchy traversal with recursive CTEs (if needed)

---

### 12. Do we need a "Teams" table yet, or will this phase extend `org_memberships`?

**Answer**: **NO separate Teams table in Phase 2**. Use `memberships` table with `reports_to` hierarchy.

**Current structure**:
- `orgs` → `branches` → `memberships` (with `branch_id`)
- Phase 2: Add `reports_to` to `memberships`

**Rationale**:
- Teams are implicit in the `reports_to` hierarchy
- A team = all users who report to the same manager
- No need for explicit team table yet
- Can be added in Phase 3 if teams need metadata (name, description, etc.)

**Future consideration**: If teams need metadata or cross-branch teams, we can add a `teams` table later.

---

### 13. Should you enforce cascading rules (e.g., when a Manager leaves, reassign reports automatically)?

**Answer**: **YES - Cascading reassignment with fallback to branch_head**.

**Rules**:
1. **Manager leaves**: Reassign all direct reports to the manager's `reports_to` (branch_head)
2. **Branch Head leaves**: Reassign all direct reports to owner (or mark as pending reassignment)
3. **Owner leaves**: Prevent deletion or transfer ownership (require explicit ownership transfer)

**Implementation**:
- Database trigger on `memberships` DELETE/UPDATE
- Or application-level logic in RPC function
- Fallback chain: Manager → Branch Head → Owner

**Migration strategy**:
- When reassigning, update `reports_to` to the manager's `reports_to`
- If `reports_to` is NULL (branch_head), set `reports_to = NULL` (reports to branch_head implicitly)
- Notify affected users of reassignment

---

### 14. How do you model role transitions — transactional updates or audit-tracked history?

**Answer**: **Transactional updates + audit log table**.

**Implementation**:
1. **Transactional update**: Update `memberships.role` directly
2. **Audit log**: Insert into `membership_history` table with:
   - `membership_id`
   - `old_role`
   - `new_role`
   - `changed_by` (profile_id)
   - `changed_at` (timestamp)
   - `reason` (optional text)

**Schema**:
```sql
CREATE TABLE membership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  old_role TEXT,
  new_role TEXT,
  old_reports_to UUID,
  new_reports_to UUID,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);
```

**Rationale**:
- Simple transactional updates for current state
- Audit log for compliance and history
- Can query history for reporting
- Doesn't complicate current state queries

---

## D. Access Control & Permissions

### 15. What exact actions differ per role (invite, edit, delete, view reports)?

**Answer**: **Permission matrix**:

| Action | Owner | Branch Head | Manager | Staff | Advisor |
|--------|-------|-------------|---------|-------|---------|
| **Invite users** | ✅ (all roles) | ✅ (staff only) | ✅ (staff only) | ❌ | ❌ |
| **Edit org settings** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Edit branch settings** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete users** | ✅ (all roles) | ✅ (staff only) | ✅ (staff only) | ❌ | ❌ |
| **View reports** | ✅ (org-wide) | ✅ (branch-wide) | ✅ (direct reports) | ❌ | ✅ (org-wide, read-only) |
| **Create invoices** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Edit invoices** | ✅ | ✅ | ✅ | ✅ (own only) | ❌ |
| **Delete invoices** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage products** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage inventory** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage customers** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View analytics** | ✅ (org-wide) | ✅ (branch-wide) | ✅ (team-wide) | ✅ (own data) | ✅ (org-wide) |
| **Approve memberships** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Approve products** | ✅ | ❌ | ❌ | ❌ | ❌ (internal only) |

**Implementation**: Extend `src/lib/permissions.ts` with new permissions and role mappings.

---

### 16. Will you centralize permission logic in middleware or distribute it per module?

**Answer**: **Centralized permission functions + distributed RLS policies**.

**Architecture**:
1. **Centralized**: `src/lib/permissions.ts` with permission check functions
2. **Distributed RLS**: Database-level RLS policies per table
3. **UI guards**: `RoleProtectedRoute` component for route-level protection
4. **API guards**: Permission checks in API functions before database calls

**Rationale**:
- Single source of truth for permissions (TypeScript)
- Database-level security (RLS) for defense in depth
- UI-level guards for better UX (hide disabled actions)
- API-level guards for validation

**Flow**:
```
UI Component → Permission Check → API Call → RLS Policy → Database
```

---

### 17. Should Advisors have cross-team analytics access without edit rights?

**Answer**: **YES - Org-wide read-only analytics access**.

**Advisor permissions**:
- ✅ View all org data (invoices, products, inventory, customers)
- ✅ View org-wide analytics and reports
- ✅ View all team activity (read-only)
- ✅ Add comments/notes (if supported)
- ❌ No edit/delete/create permissions
- ❌ No user management
- ❌ No settings access

**Implementation**:
- RLS policy: Advisors can SELECT all org data (filtered by `org_id`, not `branch_id`)
- Dashboard: Show read-only analytics view for advisors
- UI: Hide edit/delete buttons for advisors

---

### 18. How will permissions integrate with existing Supabase policies (RLS)?

**Answer**: **Extend existing RLS policies with role-based conditions**.

**Current pattern**:
```sql
CREATE POLICY "invoices_owner_all" ON invoices
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );
```

**Phase 2 extension**:
- Add policies for `manager` and `advisor` roles
- Update existing policies to include new roles
- Add hierarchy-based filtering (managers see only their team's data)

**New helper functions**:
```sql
-- Check if user can access a specific profile's data (hierarchy-based)
CREATE OR REPLACE FUNCTION can_access_profile(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  -- Returns true if current user is owner, branch_head, or manager of the profile
$$;

-- Get accessible branch IDs for current user (hierarchy-aware)
CREATE OR REPLACE FUNCTION current_user_accessible_branch_ids()
RETURNS UUID[] AS $$
  -- Returns branch IDs based on role and hierarchy
$$;
```

---

### 19. Do we need a future-proof structure for custom roles in later phases?

**Answer**: **YES - Design for extensibility, but keep Phase 2 static**.

**Phase 2**: Static enum-based roles with explicit permissions.

**Future-proofing**:
1. **Permission constants**: Use named constants (not magic strings)
2. **Permission functions**: Centralize permission logic in functions
3. **RLS helper functions**: Use helper functions for RLS policies (easier to extend)
4. **Type safety**: Use TypeScript types for roles and permissions

**Phase 3 migration path**:
- Add `roles` table with `name`, `description`, `org_id` (nullable for system roles)
- Add `role_permissions` junction table
- Migrate static permissions to database
- Update RLS policies to query `role_permissions` table

**Current structure is compatible with future migration**:
- Permission constants can map to database records
- RLS helper functions can query database instead of hardcoded logic
- No breaking changes needed

---

## E. UX / Flow Integration

### 20. When a Manager invites someone, does the invited user auto-inherit the team?

**Answer**: **YES - Auto-assign to manager's branch and set `reports_to = manager.profile_id`**.

**Invite flow**:
1. Manager clicks "Invite User"
2. System pre-fills:
   - `org_id` = manager's org
   - `branch_id` = manager's branch
   - `reports_to` = manager's profile_id
   - `role` = 'staff' (default, can be changed by branch_head/owner)
3. Manager enters email and optional role override
4. Membership created with `membership_status = 'pending'` (if manager) or `'active'` (if owner/branch_head)
5. User receives invite email
6. On acceptance, membership becomes active

**Rationale**:
- Reduces friction
- Clear hierarchy from invite
- Manager doesn't need to assign later
- Matches current branch_head invite flow

---

### 21. Will role assignment be part of the invite flow or editable afterward?

**Answer**: **Both - Assignable during invite, editable afterward by authorized users**.

**Invite flow**:
- Manager/Branch Head: Can assign `staff` role (default)
- Owner: Can assign any role
- Role can be changed during invite (dropdown)

**Post-invite editing**:
- Owner: Can change any user's role
- Branch Head: Can change staff roles in their branch
- Manager: Cannot change roles (read-only)
- Role changes require approval if user is active (or automatic if owner)

**UI**:
- Invite form: Role dropdown (filtered by inviter's permissions)
- User management page: Role dropdown (editable by authorized users)
- Role change triggers audit log entry

---

### 22. How does the dashboard adjust per role (different home view, data visibility)?

**Answer**: **Role-specific dashboard views with filtered data**.

**Dashboard variants**:

1. **Owner Dashboard**:
   - Org-wide metrics (all branches)
   - Branch comparison charts
   - Team activity across all branches
   - Pending approvals (memberships, products)

2. **Branch Head Dashboard**:
   - Branch-specific metrics
   - Team activity (branch members)
   - Pending staff approvals
   - Branch performance charts

3. **Manager Dashboard**:
   - Team-specific metrics (direct reports only)
   - Team activity (direct reports)
   - Team performance charts
   - Limited branch context

4. **Staff Dashboard**:
   - Personal metrics (own invoices, customers)
   - Quick actions (create invoice, add customer)
   - No team/org-wide data

5. **Advisor Dashboard**:
   - Org-wide analytics (read-only)
   - Comparative reports (branch performance)
   - Trend analysis
   - No action buttons (read-only)

**Implementation**:
- `DashboardPage.tsx` queries data based on `user.role`
- Different metric queries per role
- Different chart components per role
- Conditional rendering based on permissions

---

### 23. Should Advisors have a read-only dashboard view or metrics overview page?

**Answer**: **Read-only dashboard view with org-wide metrics**.

**Advisor dashboard features**:
- Org-wide revenue, invoice count, customer count
- Branch comparison charts
- Trend analysis (revenue, invoices over time)
- Team activity (read-only, no actions)
- Product performance (read-only)
- Customer insights (read-only)

**UI**:
- Same dashboard layout as owner, but all actions disabled
- "View Only" badge or watermark
- No edit/delete buttons
- Export/report buttons enabled (for sharing insights)

**Rationale**:
- Familiar interface (same as owner)
- Clear read-only indication
- Useful for external stakeholders
- Supports decision-making without edit access

---

### 24. How will errors appear if a role attempts an unauthorized action?

**Answer**: **Multi-layer error handling with clear messages**.

**Error layers**:

1. **UI layer** (prevention):
   - Disable/hide unauthorized actions
   - Show tooltip: "You don't have permission to perform this action"
   - Gray out disabled buttons

2. **API layer** (validation):
   - Permission check before database call
   - Return `403 Forbidden` with message: "You don't have permission to [action]"
   - Show toast notification with error message

3. **Database layer** (RLS):
   - RLS policy blocks unauthorized queries
   - Returns `403 Forbidden` or empty result set
   - Log security violation (optional)

**Error messages**:
- **Generic**: "You don't have permission to perform this action"
- **Specific**: "Only owners can manage org settings"
- **Actionable**: "Contact your branch head to request access"

**UI component**: `AccessDenied.tsx` (already exists) for route-level protection.

---

## F. Migration / Rollout Strategy

### 25. How do you backfill existing users with roles (default: Owner → org creator, others → Member)?

**Answer**: **Migration script with explicit backfill logic**.

**Migration steps**:

1. **Add new columns**:
   - `memberships.reports_to` (nullable UUID)
   - `memberships.role` (update enum to include 'manager', 'advisor')

2. **Backfill existing data**:
   - **Owners**: Keep `role = 'owner'`, set `reports_to = NULL`
   - **Branch Heads**: Keep `role = 'branch_head'`, set `reports_to = NULL`
   - **Staff**: Keep `role = 'staff'`, set `reports_to = branch_head.profile_id` (if branch_head exists) OR `NULL` (if no branch_head)
   - **Advisors**: N/A (new role, no existing data)

3. **Validate data**:
   - Check for cycles in `reports_to` hierarchy
   - Check for orphaned reports (reports_to references non-existent profile)
   - Check for invalid role/branch combinations

**Migration SQL**:
```sql
-- Backfill reports_to for staff members
UPDATE memberships m
SET reports_to = (
  SELECT m2.profile_id
  FROM memberships m2
  WHERE m2.org_id = m.org_id
    AND m2.branch_id = m.branch_id
    AND m2.role = 'branch_head'
  LIMIT 1
)
WHERE m.role = 'staff'
  AND m.reports_to IS NULL;
```

---

### 26. Will you handle migration via Supabase migration + script, or manual admin tooling?

**Answer**: **Supabase migration + automated script**.

**Migration strategy**:
1. **Database migration**: Create migration file in `supabase/migrations/`
   - Add `reports_to` column
   - Update role enum
   - Add constraints and indexes
   - Backfill data
   - Add audit table

2. **Application migration**: Update TypeScript types and permissions
   - Update `UserRole` type
   - Update `ROLE_PERMISSIONS` map
   - Update RLS policies (via migration)
   - Update UI components

3. **Validation**: Run validation queries after migration
   - Check data integrity
   - Test RLS policies
   - Test permission functions

**Rollback plan**:
- Keep old role enum values in migration (don't drop)
- Migration is reversible (can drop `reports_to` column)
- Audit log preserves history

---

### 27. How will you test and validate hierarchy integrity before production?

**Answer**: **Multi-layer testing strategy**.

**Testing layers**:

1. **Database tests** (migration validation):
   - Check for cycles in `reports_to` hierarchy
   - Check for orphaned reports
   - Check for invalid role combinations
   - Check for constraint violations

2. **RLS policy tests** (Supabase test suite):
   - Test each role's access to data
   - Test hierarchy-based filtering
   - Test cross-branch access (should be blocked)
   - Test advisor read-only access

3. **Application tests** (Jest/Vitest):
   - Test permission functions
   - Test invite flow
   - Test role change flow
   - Test dashboard data filtering

4. **Integration tests** (manual/automated):
   - Test full user flows (invite, accept, assign, change role)
   - Test error handling (unauthorized actions)
   - Test cascading reassignment

5. **Production validation** (post-deployment):
   - Run validation queries on production data
   - Monitor error logs for RLS violations
   - Test with real users (staged rollout)

**Validation queries**:
```sql
-- Check for cycles
WITH RECURSIVE hierarchy AS (
  SELECT profile_id, reports_to, 1 AS depth
  FROM memberships
  WHERE reports_to IS NOT NULL
  UNION ALL
  SELECT m.profile_id, m.reports_to, h.depth + 1
  FROM memberships m
  JOIN hierarchy h ON m.profile_id = h.reports_to
  WHERE h.depth < 10  -- Prevent infinite loops
)
SELECT * FROM hierarchy WHERE depth > 10;  -- Should return empty

-- Check for orphaned reports
SELECT m.*
FROM memberships m
WHERE m.reports_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM memberships m2
    WHERE m2.profile_id = m.reports_to
      AND m2.org_id = m.org_id
  );
```

---

### 28. Do you need temporary fallbacks (e.g., treat all users as Members if role undefined)?

**Answer**: **YES - Graceful degradation with fallback to 'staff' role**.

**Fallback strategy**:

1. **Database level**:
   - `role` column has DEFAULT 'staff'
   - `reports_to` can be NULL (safe default)
   - RLS policies handle NULL role (treat as 'staff')

2. **Application level**:
   - If `user.role` is NULL, treat as 'staff'
   - If `user.role` is invalid, treat as 'staff'
   - Log warning for invalid roles

3. **Migration safety**:
   - Migration sets default role for all existing users
   - No user should have NULL role after migration
   - Fallback is only for edge cases

**Implementation**:
```typescript
// In AuthContext or permission functions
const userRole = user.role || 'staff';  // Fallback to staff
const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.staff;  // Fallback to staff permissions
```

**Rationale**:
- Prevents application crashes
- Allows graceful degradation
- Supports incremental migration
- Provides safety net for edge cases

---

## Implementation Plan

### Phase 2.1: Database Schema Changes
1. Add `reports_to` column to `memberships`
2. Update role enum to include 'manager', 'advisor'
3. Add `membership_history` audit table
4. Add constraints and indexes
5. Backfill existing data

### Phase 2.2: RLS Policy Updates
1. Update existing RLS policies for new roles
2. Add hierarchy-based filtering functions
3. Add advisor read-only policies
4. Test RLS policies

### Phase 2.3: Application Updates
1. Update TypeScript types
2. Update permission functions
3. Update invite flow
4. Update dashboard views
5. Update UI components

### Phase 2.4: Testing & Validation
1. Run database validation queries
2. Test RLS policies
3. Test application flows
4. Test error handling
5. Production validation

---

## Open Questions / Decisions Needed

1. **Advisor multi-branch access**: Phase 2 (org-wide only) or Phase 3 (multi-branch)?
   - **Recommendation**: Phase 2 (org-wide only) for simplicity

2. **Manager depth**: Single level (manager → staff) or multiple levels (manager → manager → staff)?
   - **Recommendation**: Single level for Phase 2

3. **Role change approval**: Automatic (owner/branch_head) or require approval?
   - **Recommendation**: Automatic for Phase 2, approval workflow in Phase 3

4. **Advisor comments**: Should advisors be able to add comments/notes on data?
   - **Recommendation**: Yes, but in a separate `advisor_notes` table (Phase 2 or Phase 3)

5. **Intern role**: Include in Phase 2 or defer to Phase 3?
   - **Recommendation**: Defer to Phase 3 (can be implemented as staff with additional restrictions)

---

## Next Steps

1. **Review this document** with stakeholders
2. **Confirm role definitions** and permission matrix
3. **Approve migration strategy** and rollout plan
4. **Create implementation tickets** for Phase 2.1-2.4
5. **Begin implementation** with database schema changes

---

## Appendix: Current System Analysis

### Current Roles
- `owner`: Org-wide, no branch_id
- `branch_head`: Branch-level, has branch_id
- `staff`: Branch-level, has branch_id

### Current Structure
- `orgs` → `branches` → `memberships` (with branch_id)
- Single membership per user per org (UNIQUE constraint)
- RLS policies based on role and org_id/branch_id

### Current Permissions
- Static permission map in `src/lib/permissions.ts`
- Role-based RLS policies in database
- UI-level permission checks in components

### Current Limitations
- No hierarchy/reporting structure
- No manager role
- No advisor role
- No role inheritance
- No audit trail for role changes

---

**Document Version**: 1.0  
**Last Updated**: 2024-11-12  
**Status**: Draft - Pending Review


