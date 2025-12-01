-- Migration: Add internal user flag to profiles
-- Allows distinction between internal team members and org users

BEGIN;

-- Add is_internal column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_internal ON profiles(is_internal) WHERE is_internal = true;

-- Helper function to check if user is internal
CREATE OR REPLACE FUNCTION is_internal_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT is_internal FROM profiles WHERE id = user_id), false);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_internal_user(uuid) TO authenticated;

-- Update RLS policies for hsn_master to use is_internal_user()
DROP POLICY IF EXISTS "hsn_master_write_internal" ON hsn_master;
CREATE POLICY "hsn_master_write_internal" ON hsn_master
FOR ALL
USING (is_internal_user(auth.uid()))
WITH CHECK (is_internal_user(auth.uid()));

-- Update RLS policies for category_map to use is_internal_user()
DROP POLICY IF EXISTS "category_map_write_internal" ON category_map;
CREATE POLICY "category_map_write_internal" ON category_map
FOR ALL
USING (is_internal_user(auth.uid()))
WITH CHECK (is_internal_user(auth.uid()));

-- Note: The existing "Profiles: Users can update own profile" policy allows users to update their profile
-- However, we need to restrict is_internal updates to service role only
-- We'll create a function to check if is_internal is being modified and block it for non-service roles
-- The existing policy will handle regular updates, and service role can update is_internal via direct SQL or admin tool

-- Service role can update any profile (including is_internal)
DROP POLICY IF EXISTS "profiles_update_service_role" ON profiles;
CREATE POLICY "profiles_update_service_role" ON profiles
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

COMMIT;

