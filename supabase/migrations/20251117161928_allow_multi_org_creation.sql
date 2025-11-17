-- Migration: Allow users to create multiple organizations
-- Fixes: "User already has a membership" error when creating additional orgs

BEGIN;

CREATE OR REPLACE FUNCTION public.create_default_org_for_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_org_id uuid;
  v_org_name text;
  v_org_slug text;
  v_branch_id uuid;
  v_result json;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  -- Generate unique org name and slug with timestamp to prevent collisions
  v_org_name := 'My Business';
  v_org_slug := 'org-' || substring(v_user_id::text from 1 for 8) || '-' || extract(epoch from now())::bigint::text;

  -- Create organization
  INSERT INTO orgs (
    name,
    slug,
    state,
    lifecycle_state
  ) VALUES (
    v_org_name,
    v_org_slug,
    'TN',  -- Default state
    'trial'
  )
  RETURNING id INTO v_org_id;

  -- Create default branch
  INSERT INTO branches (
    org_id,
    name,
    is_default
  ) VALUES (
    v_org_id,
    'Main Branch',
    true
  )
  RETURNING id INTO v_branch_id;

  -- Create membership for the user as owner
  INSERT INTO memberships (
    org_id,
    profile_id,
    role,
    branch_id,
    membership_status
  ) VALUES (
    v_org_id,
    v_user_id,
    'owner',
    v_branch_id,
    'active'
  );

  -- Create trial subscription
  INSERT INTO org_subscriptions (
    org_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_org_id,
    NULL,
    'trialing',
    now(),
    now() + interval '90 days',
    false,
    '{}'::jsonb,
    now(),
    now()
  );

  -- Return result
  v_result := json_build_object(
    'success', true,
    'org_id', v_org_id,
    'org_slug', v_org_slug,
    'branch_id', v_branch_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create organization: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_default_org_for_user() TO authenticated;

COMMENT ON FUNCTION public.create_default_org_for_user() IS 
'Creates a new organization for the current user. Can be called multiple times to create multiple businesses. Each org gets a unique slug with timestamp.';

COMMIT;

