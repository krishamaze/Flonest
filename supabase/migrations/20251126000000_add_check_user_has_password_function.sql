-- Migration: Add check_user_has_password function
-- This function checks if the current authenticated user has a password set
-- Returns true if user has encrypted_password, false for OAuth-only users
-- Required by: ProtectedRoute.tsx for password-based auth flow

BEGIN;

CREATE OR REPLACE FUNCTION public.check_user_has_password()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_has_password boolean;
BEGIN
  -- Check if user has encrypted_password in auth.users
  -- OAuth-only users have NULL encrypted_password
  SELECT (encrypted_password IS NOT NULL AND encrypted_password != '') INTO v_has_password
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_has_password, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_has_password() TO authenticated;

COMMIT;

