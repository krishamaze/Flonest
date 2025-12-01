-- Migration: Restrict check_platform_admin_email to prevent enumeration
-- CRITICAL: Function is currently callable by anon role, allowing attackers to enumerate admin emails
--
-- Security risk:
-- - Anyone can call check_platform_admin_email() with any email to discover platform admins
-- - This violates security principle of not revealing privileged account list
--
-- This migration:
-- 1. Removes anon access to check_platform_admin_email
-- 2. Restricts to authenticated users only (reduces enumeration risk)
-- 3. Note: Login flow will need update - check should happen AFTER sign-in, not before
--
-- TODO: Move this check to Edge Function for true server-side enforcement

BEGIN;

-- Revoke anon access (prevents enumeration by unauthenticated users)
REVOKE EXECUTE ON FUNCTION check_platform_admin_email(text) FROM anon;

-- Keep authenticated access (for now - login flow needs update)
-- Authenticated users are less likely to enumerate (they're already logged in)
GRANT EXECUTE ON FUNCTION check_platform_admin_email(text) TO authenticated;

-- Update comment to reflect security change
COMMENT ON FUNCTION check_platform_admin_email(text) IS 
'Checks if an email belongs to a platform admin. Returns true if platform_admin flag is set in profiles table. 
SECURITY: Only callable by authenticated users (anon access removed to prevent enumeration).
TODO: Move to Edge Function for true server-side enforcement.';

COMMIT;

