-- Migration: Fix master_products RLS policies - ensure function works correctly
-- 
-- Issue: Policies exist but 403 errors persist. Need to ensure:
-- 1. current_user_is_platform_admin() function can access profiles table
-- 2. Policies explicitly target authenticated role
-- 3. Function handles RLS context correctly

BEGIN;

-- =====================================================
-- 1. Ensure current_user_is_platform_admin() explicitly bypasses RLS
-- =====================================================
-- SECURITY DEFINER functions should bypass RLS, but let's be explicit
-- by ensuring the function can access profiles even if RLS is enabled

CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
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

-- =====================================================
-- 2. Recreate policies with explicit TO authenticated clause
-- =====================================================
-- While roles: "{public}" works, being explicit helps with debugging

DROP POLICY IF EXISTS "master_products_read_platform_admin" ON public.master_products;
DROP POLICY IF EXISTS "master_products_read_approved" ON public.master_products;
DROP POLICY IF EXISTS "master_products_read_own_pending" ON public.master_products;
DROP POLICY IF EXISTS "master_products_update_platform_admin" ON public.master_products;

-- Policy 1: Platform admin - Full SELECT access to ALL products
CREATE POLICY "master_products_read_platform_admin"
ON public.master_products
FOR SELECT
TO authenticated
USING (public.current_user_is_platform_admin());

-- Policy 2: Public read - Only approved + active products
CREATE POLICY "master_products_read_approved"
ON public.master_products
FOR SELECT
TO authenticated
USING (
  status = 'active'
  AND approval_status = 'approved'
);

-- Policy 3: Org users - Can see their own pending/auto_pass/rejected submissions
CREATE POLICY "master_products_read_own_pending"
ON public.master_products
FOR SELECT
TO authenticated
USING (
  approval_status IN ('pending', 'auto_pass', 'rejected')
  AND submitted_org_id IN (
    SELECT org_id
    FROM public.memberships
    WHERE profile_id = auth.uid()
      AND membership_status = 'active'
    LIMIT 1
  )
);

-- Policy 4: Platform admin - Full UPDATE access
CREATE POLICY "master_products_update_platform_admin"
ON public.master_products
FOR UPDATE
TO authenticated
USING (public.current_user_is_platform_admin())
WITH CHECK (public.current_user_is_platform_admin());

COMMIT;

