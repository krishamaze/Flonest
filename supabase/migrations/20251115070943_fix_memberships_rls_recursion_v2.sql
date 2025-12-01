-- Migration: Fix memberships helper recursion by disabling RLS inside helper functions
-- Ensures helper functions querying memberships do not trigger memberships RLS policies

BEGIN;

-- current_user_org_id
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SET LOCAL row_security = off;
  SELECT org_id INTO v_org_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v_org_id;
END;
$$;

-- current_user_role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_role text;
BEGIN
  SET LOCAL row_security = off;
  SELECT role INTO v_role
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v_role;
END;
$$;

-- current_user_branch_id
CREATE OR REPLACE FUNCTION current_user_branch_id()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_branch_id uuid;
BEGIN
  SET LOCAL row_security = off;
  SELECT branch_id INTO v_branch_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v_branch_id;
END;
$$;

-- current_user_is_internal
CREATE OR REPLACE FUNCTION current_user_is_internal()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_is_internal boolean;
BEGIN
  SET LOCAL row_security = off;
  SELECT platform_admin INTO v_is_internal
  FROM profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_is_internal, false);
END;
$$;

-- is_internal_user
CREATE OR REPLACE FUNCTION is_internal_user(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_is_internal boolean;
BEGIN
  SET LOCAL row_security = off;
  SELECT platform_admin INTO v_is_internal
  FROM profiles
  WHERE id = user_id;
  RETURN COALESCE(v_is_internal, false);
END;
$$;

COMMIT;

