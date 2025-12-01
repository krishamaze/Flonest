-- Normalize roles: owner→admin, staff→advisor, add platform_admin
-- Remove is_internal, replace with platform_admin boolean

BEGIN;

-- Step 1: Add platform_admin to profiles (default false)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS platform_admin BOOLEAN DEFAULT false;

-- Step 2: Migrate is_internal to platform_admin (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'is_internal'
  ) THEN
    UPDATE profiles 
    SET platform_admin = is_internal 
    WHERE is_internal = true;
  END IF;
END $$;

-- Step 3: Add new role values to memberships enum
ALTER TABLE memberships 
  DROP CONSTRAINT IF EXISTS memberships_role_check;

ALTER TABLE memberships 
  ADD CONSTRAINT memberships_role_check 
  CHECK (role IN ('owner', 'admin', 'branch_head', 'staff', 'advisor', 'viewer'));

-- Step 4: Migrate existing role data
-- owner → admin
UPDATE memberships 
SET role = 'admin' 
WHERE role = 'owner';

-- staff → advisor
UPDATE memberships 
SET role = 'advisor' 
WHERE role = 'staff';

-- viewer remains as is (for now, will be removed from org memberships later if needed)

-- Step 5: Update constraint to only include new roles
ALTER TABLE memberships 
  DROP CONSTRAINT memberships_role_check;

ALTER TABLE memberships 
  ADD CONSTRAINT memberships_role_check 
  CHECK (role IN ('admin', 'branch_head', 'advisor', 'viewer'));

-- Step 6: Drop is_internal column from profiles (data already migrated) - conditional
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'is_internal'
  ) THEN
    ALTER TABLE profiles DROP COLUMN is_internal;
  END IF;
END $$;

-- Step 7: Update RLS policies that reference 'owner' role
-- Drop old policies
DROP POLICY IF EXISTS "Memberships: Owners can manage memberships" ON memberships;

-- Recreate with 'admin' role
CREATE POLICY "Memberships: Admins can manage memberships" ON memberships
  FOR ALL USING (
    org_id IN (
      SELECT m.org_id FROM memberships m
      INNER JOIN profiles p ON p.id = m.profile_id
      WHERE p.id = auth.uid() AND m.role = 'admin'
    )
  );

-- Step 8: Drop old helper function and create new one
DROP FUNCTION IF EXISTS current_user_is_owner();

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.profile_id = auth.uid()
      AND m.role = 'admin'
  );
$$;

-- Step 9: Ensure current_user_is_branch_head exists
CREATE OR REPLACE FUNCTION current_user_is_branch_head()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.profile_id = auth.uid()
      AND m.role = 'branch_head'
  );
$$;

-- Step 10: Add index for faster platform_admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_platform_admin 
  ON profiles(platform_admin) 
  WHERE platform_admin = true;

COMMIT;

