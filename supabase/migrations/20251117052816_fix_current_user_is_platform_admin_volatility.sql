-- Fix current_user_is_platform_admin() function volatility
-- Error: "SET is not allowed in a non-volatile function"
-- The function uses SET LOCAL row_security = off, which requires VOLATILE

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE  -- Changed from STABLE to VOLATILE because SET LOCAL is used
AS $$
DECLARE
  v_platform_admin boolean;
BEGIN
  -- Explicitly disable RLS for this query to ensure it works
  SET LOCAL row_security = off;
  
  SELECT COALESCE(platform_admin, false) INTO v_platform_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_platform_admin, false);
END;
$$;

COMMIT;

