-- Migration: Fix RLS infinite recursion by converting helper functions to SECURITY DEFINER
-- Using CREATE OR REPLACE to avoid breaking existing policy dependencies

BEGIN;

-- Step 1: Redefine helper functions as SECURITY DEFINER SQL functions
-- SQL functions with SECURITY DEFINER bypass RLS completely
-- Using CREATE OR REPLACE to update in place without breaking dependencies

CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT org_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_branch_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT branch_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_is_branch_head()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships
    WHERE profile_id = auth.uid()
      AND membership_status = 'active'
      AND role = 'branch_head'
      AND org_id = current_user_org_id()
  );
$$;

CREATE OR REPLACE FUNCTION current_user_branch_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
  v_org_id uuid;
BEGIN
  -- Get user's role and org_id (bypasses RLS via SECURITY DEFINER)
  SELECT role, org_id INTO v_role, v_org_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;

  -- Owner: return all branch IDs for their org
  IF v_role = 'owner' THEN
    RETURN ARRAY(
      SELECT id FROM branches WHERE org_id = v_org_id
    );
  -- Branch Head and Staff: return their single branch_id
  ELSIF v_role IN ('branch_head', 'staff') THEN
    RETURN ARRAY[current_user_branch_id()];
  -- Internal or no membership: return empty array
  ELSE
    RETURN ARRAY[]::uuid[];
  END IF;
END;
$$;

-- Step 2: Drop ALL existing membership policies (clean slate)
DROP POLICY IF EXISTS "Memberships: Users can view org memberships" ON memberships;
DROP POLICY IF EXISTS "Memberships: Users can view own membership" ON memberships;
DROP POLICY IF EXISTS "Memberships: Owners can manage org memberships" ON memberships;
DROP POLICY IF EXISTS "Memberships: Owners can delete org memberships" ON memberships;
DROP POLICY IF EXISTS "memberships_owner_all" ON memberships;
DROP POLICY IF EXISTS "memberships_branch_scope" ON memberships;
DROP POLICY IF EXISTS "memberships_view" ON memberships;
DROP POLICY IF EXISTS "memberships_view_active" ON memberships;
DROP POLICY IF EXISTS "memberships_owner_view_all" ON memberships;
DROP POLICY IF EXISTS "memberships_self_view" ON memberships;

-- Step 3: Add minimal self-view policy (no recursion - direct auth.uid() check)
-- This must come first to allow users to read their own membership for context loading
CREATE POLICY "memberships_self_view" ON memberships
  FOR SELECT
  USING (profile_id = auth.uid() AND membership_status = 'active');

-- Step 4: Rebuild role-based policies (now safe - helpers bypass RLS via SECURITY DEFINER)
-- Owner: Full CRUD on all memberships in their org
CREATE POLICY "memberships_owner_all" ON memberships
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  )
  WITH CHECK (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

-- Branch Head: Can manage staff only in their branch
CREATE POLICY "memberships_branch_scope" ON memberships
  FOR ALL
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
    AND branch_id = current_user_branch_id()
    AND role = 'staff'
  )
  WITH CHECK (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'branch_head'
    AND branch_id = current_user_branch_id()
    AND role = 'staff'
    AND membership_status IN ('pending', 'active')
  );

-- All roles: Can view active memberships in their org
CREATE POLICY "memberships_view_active" ON memberships
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND membership_status = 'active'
  );

-- Owner: Can view all memberships (including pending) in their org
CREATE POLICY "memberships_owner_view_all" ON memberships
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

COMMIT;

