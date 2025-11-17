-- Migration: Debug RLS function and add direct policy as fallback
-- 
-- Issue: Authorization header present, JWT valid, but 403 persists
-- This suggests current_user_is_platform_admin() function isn't evaluating correctly
-- 
-- Solution: Add a direct policy that checks profiles.platform_admin inline
-- This bypasses the function to test if that's the issue

BEGIN;

-- =====================================================
-- Add a direct platform admin policy (bypasses function)
-- =====================================================
-- This policy checks profiles.platform_admin directly instead of using the function
-- If this works, we know the function is the problem

CREATE POLICY "master_products_read_platform_admin_direct"
ON public.master_products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND platform_admin = true
  )
);

-- Note: We're keeping both policies for now
-- The direct policy should match first, but if function works, both will match
-- RLS uses OR logic, so either policy matching grants access

COMMIT;

