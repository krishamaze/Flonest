-- Agent Portal: Normalize roles (owner→admin, staff→advisor) and add platform_admin
-- This migration updates role terminology to match business-friendly naming

BEGIN;

-- Step 1: Add platform_admin column to profiles (replaces is_internal)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS platform_admin BOOLEAN DEFAULT false;

-- Step 2: Migrate is_internal to platform_admin (if is_internal exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_internal'
  ) THEN
    UPDATE profiles SET platform_admin = is_internal WHERE is_internal = true;
    ALTER TABLE profiles DROP COLUMN is_internal;
  END IF;
END $$;

-- Step 3: Update memberships role enum to include 'admin' and 'advisor'
-- First, remove the CHECK constraint
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;

-- Update existing values: 'owner' → 'admin', 'staff' → 'advisor'
UPDATE memberships SET role = 'admin' WHERE role = 'owner';
UPDATE memberships SET role = 'advisor' WHERE role = 'staff';

-- Add new CHECK constraint with updated roles
ALTER TABLE memberships 
  ADD CONSTRAINT memberships_role_check 
  CHECK (role IN ('admin', 'branch_head', 'advisor', 'viewer'));

-- Step 4: Update function current_user_is_owner to current_user_is_admin
-- Drop old function if it exists
DROP FUNCTION IF EXISTS current_user_is_owner();

-- Create new function with updated name
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE profile_id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

-- Step 5: Update current_user_is_branch_head to check for branch_head role
CREATE OR REPLACE FUNCTION current_user_is_branch_head()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE profile_id = auth.uid()
      AND role = 'branch_head'
  );
END;
$$;

-- Step 6: Create helper function to check if user is admin or branch_head
CREATE OR REPLACE FUNCTION current_user_can_manage_org()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE profile_id = auth.uid()
      AND role IN ('admin', 'branch_head')
  );
END;
$$;

-- Step 7: Add index for platform_admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_platform_admin ON profiles(platform_admin) WHERE platform_admin = true;

-- Step 8: Add comment to document role hierarchy
COMMENT ON COLUMN memberships.role IS 'User role in organization: admin (full access), branch_head (branch management), advisor (basic staff), viewer (read-only - deprecated)';
COMMENT ON COLUMN profiles.platform_admin IS 'Platform-level admin access for internal SaaS team (separate from org roles)';

COMMIT;

