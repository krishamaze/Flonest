-- Migration: Fix infinite recursion in memberships RLS policies
-- CRITICAL: Helper functions current_user_org_id(), current_user_role(), current_user_branch_id()
-- query memberships table, causing infinite recursion when called from memberships RLS policies
--
-- Problem:
-- - Memberships policies call current_user_org_id() / current_user_role()
-- - These functions query memberships table
-- - This triggers RLS policies again → infinite recursion
--
-- Solution:
-- - Make helper functions bypass RLS using SET LOCAL row_security = off
-- - This allows functions to read memberships without triggering RLS policies

BEGIN;

-- Fix current_user_org_id() to bypass RLS
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Bypass RLS to prevent infinite recursion
  SET LOCAL row_security = off;
  
  SELECT org_id INTO v_org_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
  
  RETURN v_org_id;
END;
$$;

-- Fix current_user_role() to bypass RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Bypass RLS to prevent infinite recursion
  SET LOCAL row_security = off;
  
  SELECT role INTO v_role
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
  
  RETURN v_role;
END;
$$;

-- Fix current_user_branch_id() to bypass RLS
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
BEGIN
  -- Bypass RLS to prevent infinite recursion
  SET LOCAL row_security = off;
  
  SELECT branch_id INTO v_branch_id
  FROM memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
  
  RETURN v_branch_id;
END;
$$;

COMMIT;

