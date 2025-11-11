-- Migration: Add membership approval workflow
-- Adds membership_status column and approval RPC function
-- Enforces: Branch Heads create pending staff, Owners approve them

BEGIN;

-- Step 1: Add membership_status column to memberships
ALTER TABLE memberships
  ADD COLUMN membership_status TEXT 
  CHECK (membership_status IN ('pending', 'active', 'inactive')) 
  DEFAULT 'active';

-- Step 2: Add branch_head_id to branches table (optional FK for tracking)
ALTER TABLE branches
  ADD COLUMN branch_head_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_branches_branch_head ON branches(branch_head_id);

-- Step 3: Backfill existing memberships as 'active'
UPDATE memberships
SET membership_status = 'active'
WHERE membership_status IS NULL;

-- Step 4: Update default to 'pending' for new memberships created by branch heads
-- (This will be enforced in application logic and RPC functions)

-- Step 5: Create RPC function to approve membership (Owner-only)
CREATE OR REPLACE FUNCTION approve_membership(p_membership_id UUID)
RETURNS JSON AS $$
DECLARE
  v_membership memberships%ROWTYPE;
  v_approver_role TEXT;
  v_approver_org_id UUID;
BEGIN
  -- Get current user's role and org
  SELECT m.role, m.org_id INTO v_approver_role, v_approver_org_id
  FROM memberships m
  INNER JOIN profiles p ON p.id = m.profile_id
  WHERE p.id = auth.uid()
  LIMIT 1;

  -- Only owners can approve memberships
  IF v_approver_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can approve memberships';
  END IF;

  -- Get the membership to approve
  SELECT * INTO v_membership
  FROM memberships
  WHERE id = p_membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  -- Verify membership belongs to approver's org
  IF v_membership.org_id != v_approver_org_id THEN
    RAISE EXCEPTION 'Cannot approve membership from different organization';
  END IF;

  -- Verify membership is pending
  IF v_membership.membership_status != 'pending' THEN
    RAISE EXCEPTION 'Membership is not pending approval';
  END IF;

  -- Approve the membership
  UPDATE memberships
  SET membership_status = 'active'
  WHERE id = p_membership_id;

  RETURN json_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'status', 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create RPC function to create staff membership (Branch Head can call)
-- This automatically sets status to 'pending' for branch head-created staff
CREATE OR REPLACE FUNCTION create_staff_membership(
  p_profile_id UUID,
  p_branch_id UUID,
  p_email TEXT
)
RETURNS JSON AS $$
DECLARE
  v_creator_role TEXT;
  v_creator_org_id UUID;
  v_creator_branch_id UUID;
  v_branch_org_id UUID;
  v_new_membership_id UUID;
BEGIN
  -- Get creator's role, org, and branch
  SELECT m.role, m.org_id, m.branch_id INTO v_creator_role, v_creator_org_id, v_creator_branch_id
  FROM memberships m
  INNER JOIN profiles p ON p.id = m.profile_id
  WHERE p.id = auth.uid()
    AND m.membership_status = 'active'
  LIMIT 1;

  -- Only branch_head and owner can create staff
  IF v_creator_role NOT IN ('owner', 'branch_head') THEN
    RAISE EXCEPTION 'Only owners and branch heads can create staff memberships';
  END IF;

  -- Verify branch belongs to creator's org
  SELECT org_id INTO v_branch_org_id
  FROM branches
  WHERE id = p_branch_id;

  IF v_branch_org_id != v_creator_org_id THEN
    RAISE EXCEPTION 'Branch does not belong to your organization';
  END IF;

  -- Branch head can only create staff in their own branch
  IF v_creator_role = 'branch_head' AND p_branch_id != v_creator_branch_id THEN
    RAISE EXCEPTION 'Branch heads can only create staff in their own branch';
  END IF;

  -- Create membership with appropriate status
  -- Owner-created: active, Branch Head-created: pending
  INSERT INTO memberships (profile_id, org_id, branch_id, role, membership_status)
  VALUES (
    p_profile_id,
    v_creator_org_id,
    p_branch_id,
    'staff',
    CASE 
      WHEN v_creator_role = 'owner' THEN 'active'
      ELSE 'pending'
    END
  )
  RETURNING id INTO v_new_membership_id;

  RETURN json_build_object(
    'success', true,
    'membership_id', v_new_membership_id,
    'status', CASE WHEN v_creator_role = 'owner' THEN 'active' ELSE 'pending' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Update RLS policies to handle membership_status
-- Users can only see active memberships (or pending if they're the owner)
DROP POLICY IF EXISTS "memberships_view" ON memberships;

-- All roles: Can view active memberships in their org
CREATE POLICY "memberships_view_active" ON memberships
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND membership_status = 'active'
  );

-- Owners: Can view all memberships (including pending) in their org
CREATE POLICY "memberships_owner_view_all" ON memberships
  FOR SELECT
  USING (
    NOT current_user_is_internal()
    AND org_id = current_user_org_id()
    AND current_user_role() = 'owner'
  );

-- Step 8: Update membership management policies to respect status
-- Owners can manage all memberships
-- Branch heads can only create staff (which become pending)

COMMIT;

