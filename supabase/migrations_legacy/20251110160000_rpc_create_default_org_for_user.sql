-- Fix org creation 403 error by creating SECURITY DEFINER RPC function
-- NOTE: Auto-org creation is disabled in production. This RPC is kept for:
-- 1. Manual test org creation during development
-- 2. Creating test accounts with dummy data
-- 3. Future org join/invite flow implementation
--
-- In production, users must be invited to an org or join via org code.

BEGIN;

-- Function to create default org and membership for authenticated user
-- Auto-generates org name and slug: 'test-' || first 8 chars of user ID
-- Uses SECURITY DEFINER to bypass RLS for org/membership creation
-- FOR TESTING/MANUAL USE ONLY - not called automatically in production
CREATE OR REPLACE FUNCTION create_default_org_for_user()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_org_id UUID;
  v_membership_id UUID;
  v_org_name TEXT;
  v_org_slug TEXT;
  v_org_record orgs%ROWTYPE;
  v_membership_record memberships%ROWTYPE;
  v_result JSON;
BEGIN
  -- Verify user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Verify user has a profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE id = v_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Please create profile first.';
  END IF;

  -- Check if user already has a membership
  SELECT id INTO v_membership_id
  FROM memberships
  WHERE profile_id = v_user_id
  LIMIT 1;

  IF v_membership_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a membership';
  END IF;

  -- Auto-generate org name and slug: 'test-' || first 8 chars of user ID
  v_org_name := 'test-' || LEFT(v_user_id::TEXT, 8);
  v_org_slug := 'test-' || LEFT(v_user_id::TEXT, 8);

  -- Create org
  INSERT INTO orgs (name, slug, state, gst_enabled)
  VALUES (v_org_name, v_org_slug, 'Default', false)
  RETURNING * INTO v_org_record;

  v_org_id := v_org_record.id;

  -- Create membership with owner role
  INSERT INTO memberships (profile_id, org_id, role)
  VALUES (v_profile_id, v_org_id, 'owner')
  RETURNING * INTO v_membership_record;

  v_membership_id := v_membership_record.id;

  -- Return result as JSON
  v_result := json_build_object(
    'org_id', v_org_id,
    'membership_id', v_membership_id,
    'org', row_to_json(v_org_record),
    'membership', row_to_json(v_membership_record)
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Org slug already exists: %', v_org_slug;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating default org: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_default_org_for_user() TO authenticated;

COMMIT;

