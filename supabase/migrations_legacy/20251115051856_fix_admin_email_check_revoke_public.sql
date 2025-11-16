-- Migration: Fix check_platform_admin_email - Revoke PUBLIC grant
-- CRITICAL SECURITY FIX: Function currently has PUBLIC grant, allowing anon access
--
-- Problem:
-- - Previous migration revoked from 'anon' but function has 'PUBLIC' grant
-- - PUBLIC grant includes anon role, so revocation didn't work
-- - Anon users can still enumerate admin emails
--
-- This migration:
-- 1. Revokes EXECUTE from PUBLIC (removes access from all roles)
-- 2. Grants EXECUTE only to authenticated and service_role
-- 3. Ensures anon cannot execute the function

BEGIN;

-- Step 1: Revoke from PUBLIC (this removes access from all roles including anon)
REVOKE EXECUTE ON FUNCTION check_platform_admin_email(text) FROM PUBLIC;

-- Step 2: Revoke from anon explicitly (in case it was granted directly)
REVOKE EXECUTE ON FUNCTION check_platform_admin_email(text) FROM anon;

-- Step 3: Grant only to authenticated users and service_role
GRANT EXECUTE ON FUNCTION check_platform_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_platform_admin_email(text) TO service_role;

-- Step 4: Verify permissions (will fail if function doesn't exist)
DO $$
BEGIN
  -- Check that PUBLIC doesn't have access
  IF EXISTS (
    SELECT 1 
    FROM information_schema.routine_privileges 
    WHERE routine_name = 'check_platform_admin_email' 
      AND grantee = 'PUBLIC'
  ) THEN
    RAISE EXCEPTION 'PUBLIC still has access - revocation failed';
  END IF;
  
  -- Check that anon doesn't have access
  IF EXISTS (
    SELECT 1 
    FROM information_schema.routine_privileges 
    WHERE routine_name = 'check_platform_admin_email' 
      AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'anon still has access - revocation failed';
  END IF;
  
  RAISE NOTICE 'Permissions fixed successfully - anon can no longer execute function';
END $$;

COMMIT;

