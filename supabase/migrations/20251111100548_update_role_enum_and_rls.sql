-- Migration: Update role enum and RLS policies for 4-tier role system
-- Changes: ('owner', 'staff', 'viewer') → ('owner', 'branch_head', 'staff')
-- Adds helper functions and role-based RLS policy grouping

BEGIN;

-- Step 1: Migrate existing viewer roles to staff
UPDATE memberships
SET role = 'staff'
WHERE role = 'viewer';

-- Step 2: Drop existing CHECK constraint
ALTER TABLE memberships
  DROP CONSTRAINT IF EXISTS memberships_role_check;

-- Step 3: Add new CHECK constraint with updated roles
ALTER TABLE memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('owner', 'branch_head', 'staff'));

-- Step 4: Add constraint for branch_id/role relationship
-- Owner must have NULL branch_id, branch_head/staff must have branch_id
ALTER TABLE memberships
  DROP CONSTRAINT IF EXISTS memberships_branch_role_check;

ALTER TABLE memberships
  ADD CONSTRAINT memberships_branch_role_check
  CHECK (
    (role = 'owner' AND branch_id IS NULL) OR
    (role IN ('branch_head', 'staff') AND branch_id IS NOT NULL)
  );

-- Step 5: Update default role (already 'staff', but ensure it's explicit)
ALTER TABLE memberships
  ALTER COLUMN role SET DEFAULT 'staff';

-- Step 6: Add helper functions

-- Get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT m.role
    FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is branch head
CREATE OR REPLACE FUNCTION current_user_is_branch_head()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT m.role = 'branch_head'
    FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
      AND m.org_id = current_user_org_id()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is internal (platform-level)
CREATE OR REPLACE FUNCTION current_user_is_internal()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(is_internal, false)
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's branch_id (NULL for owners)
CREATE OR REPLACE FUNCTION current_user_branch_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT m.branch_id
    FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get array of accessible branch IDs for current user
CREATE OR REPLACE FUNCTION current_user_branch_ids()
RETURNS UUID[] AS $$
DECLARE
  v_role TEXT;
  v_org_id UUID;
BEGIN
  -- Get user's role and org_id
  SELECT m.role, m.org_id INTO v_role, v_org_id
  FROM memberships m
  INNER JOIN profiles p ON p.id = m.profile_id
  WHERE p.id = auth.uid()
  LIMIT 1;

  -- Owner: return all branch IDs for their org (or NULL array for org-wide pattern)
  IF v_role = 'owner' THEN
    RETURN ARRAY(
      SELECT id FROM branches WHERE org_id = v_org_id
    );
  -- Branch Head and Staff: return their single branch_id
  ELSIF v_role IN ('branch_head', 'staff') THEN
    RETURN ARRAY[current_user_branch_id()];
  -- Internal or no membership: return empty array
  ELSE
    RETURN ARRAY[]::UUID[];
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Update RLS policies with role-based grouping
-- Drop old policies first, then create grouped policies

-- ============================================
-- INVOICES: Role-based access with internal exclusion
-- ============================================
DROP POLICY IF EXISTS "Invoices: Users can manage org invoices" ON invoices;
DROP POLICY IF EXISTS "invoices_read_internal" ON invoices;

-- Owner: Full CRUD (org-wide)
CREATE POLICY "invoices_owner_all" ON invoices
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

-- Branch Head: Full CRUD (org-scoped, branch filtering layered later)
CREATE POLICY "invoices_branch_scope" ON invoices
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
  );

-- Staff: SELECT and INSERT only (limited writes)
CREATE POLICY "invoices_staff_limited" ON invoices
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  );

CREATE POLICY "invoices_staff_insert" ON invoices
  FOR INSERT
  WITH CHECK (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  );

-- ============================================
-- PRODUCTS: Role-based access with internal exclusion
-- ============================================
DROP POLICY IF EXISTS "products_tenant_isolation" ON products;

-- Owner: Full CRUD
CREATE POLICY "products_owner_all" ON products
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

-- Branch Head: Full CRUD
CREATE POLICY "products_branch_scope" ON products
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
  );

-- Staff: SELECT only (read-only)
CREATE POLICY "products_staff_limited" ON products
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  );

-- ============================================
-- CUSTOMERS: Role-based access with internal exclusion
-- ============================================
DROP POLICY IF EXISTS "customers_org_isolation" ON customers;

-- Owner: Full CRUD
CREATE POLICY "customers_owner_all" ON customers
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

-- Branch Head: Full CRUD
CREATE POLICY "customers_branch_scope" ON customers
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
  );

-- Staff: SELECT and INSERT/UPDATE (can manage customers)
CREATE POLICY "customers_staff_limited" ON customers
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  );

CREATE POLICY "customers_staff_write" ON customers
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  )
  WITH CHECK (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  );

-- ============================================
-- STOCK_LEDGER: Role-based access with internal exclusion
-- ============================================
DROP POLICY IF EXISTS "stock_ledger_tenant_isolation" ON stock_ledger;

-- Owner: Full CRUD
CREATE POLICY "stock_ledger_owner_all" ON stock_ledger
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

-- Branch Head: Full CRUD
CREATE POLICY "stock_ledger_branch_scope" ON stock_ledger
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
  );

-- Staff: SELECT only (read-only)
CREATE POLICY "stock_ledger_staff_limited" ON stock_ledger
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'staff'
  );

-- ============================================
-- MEMBERSHIPS: Role-based management
-- ============================================
DROP POLICY IF EXISTS "Memberships: Owners can manage memberships" ON memberships;

-- Owner: Can manage all memberships in their org
CREATE POLICY "memberships_owner_all" ON memberships
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id IN (
      SELECT m.org_id FROM memberships m
      INNER JOIN profiles p ON p.id = m.profile_id
      WHERE p.id = auth.uid() AND m.role = 'owner'
    )
  );

-- Branch Head: Can manage staff only in their branch
CREATE POLICY "memberships_branch_scope" ON memberships
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
    AND branch_id = current_user_branch_id()
    AND role = 'staff'  -- Can only manage staff, not other branch heads
  );

-- All roles: Can view memberships in their org
CREATE POLICY "memberships_view" ON memberships
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
  );

-- ============================================
-- BRANCHES: Role-based access
-- ============================================
-- Owner and Branch Head: Can view branches in their org
-- Staff: Read-only
CREATE POLICY "branches_owner_all" ON branches
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

CREATE POLICY "branches_branch_scope" ON branches
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() IN ('branch_head', 'staff')
  );

COMMIT;

