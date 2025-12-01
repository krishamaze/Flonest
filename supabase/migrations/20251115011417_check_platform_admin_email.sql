-- RPC: Check if email is a platform admin
-- Returns boolean indicating if email requires SSO authentication
-- This is called server-side to avoid exposing admin email list client-side

BEGIN;

CREATE OR REPLACE FUNCTION check_platform_admin_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if email exists in profiles table with platform_admin = true
  SELECT COALESCE(platform_admin, false) INTO v_is_admin
  FROM profiles
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  -- Return false if no profile found (not an admin)
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Grant execute permission to authenticated users (for login check)
GRANT EXECUTE ON FUNCTION check_platform_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_platform_admin_email(text) TO anon;

COMMENT ON FUNCTION check_platform_admin_email(text) IS 'Checks if an email belongs to a platform admin. Returns true if platform_admin flag is set in profiles table. Used server-side to determine authentication method without exposing admin email list.';

COMMIT;

