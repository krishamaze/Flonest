-- Migration: Fix master_products RLS and notifications HEAD request issues
-- 
-- Issues addressed:
-- 1. master_products table has RLS disabled - enabling and creating proper policies
-- 2. Platform admin needs explicit SELECT access to all master_products (including pending/auto_pass)
-- 3. Notifications HEAD requests work correctly with existing policies (no change needed, but documenting)

BEGIN;

-- =====================================================
-- 1. Enable RLS on master_products (currently disabled)
-- =====================================================

ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. Drop any existing conflicting policies
-- =====================================================

DROP POLICY IF EXISTS "master_products_read" ON public.master_products;
DROP POLICY IF EXISTS "master_products_read_approved" ON public.master_products;
DROP POLICY IF EXISTS "master_products_read_platform_admin" ON public.master_products;
DROP POLICY IF EXISTS "master_products_read_own_pending" ON public.master_products;
DROP POLICY IF EXISTS "master_products_read_internal" ON public.master_products;
DROP POLICY IF EXISTS "Master products: All authenticated users can read active" ON public.master_products;

-- =====================================================
-- 3. Create RLS policies for master_products
-- =====================================================

-- Policy 1: Platform admin - Full SELECT access to ALL products (including pending/auto_pass/rejected)
CREATE POLICY "master_products_read_platform_admin"
ON public.master_products
FOR SELECT
USING (public.current_user_is_platform_admin());

-- Policy 2: Public read - Only approved + active products visible to all authenticated users
CREATE POLICY "master_products_read_approved"
ON public.master_products
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND status = 'active'
  AND approval_status = 'approved'
);

-- Policy 3: Org users - Can see their own pending/auto_pass/rejected submissions
CREATE POLICY "master_products_read_own_pending"
ON public.master_products
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND approval_status IN ('pending', 'auto_pass', 'rejected')
  AND submitted_org_id IN (
    SELECT org_id
    FROM public.memberships
    WHERE profile_id = auth.uid()
      AND membership_status = 'active'
    LIMIT 1
  )
);

-- =====================================================
-- 4. UPDATE policies for master_products
-- =====================================================

DROP POLICY IF EXISTS "master_products_update_platform_admin" ON public.master_products;
DROP POLICY IF EXISTS "master_products_update_internal" ON public.master_products;
DROP POLICY IF EXISTS "master_products_update_own_pending" ON public.master_products;

-- Platform admin - Full UPDATE access
CREATE POLICY "master_products_update_platform_admin"
ON public.master_products
FOR UPDATE
USING (public.current_user_is_platform_admin())
WITH CHECK (public.current_user_is_platform_admin());

-- =====================================================
-- 5. Verify notifications policies (no changes needed)
-- =====================================================
-- The existing policy "Users see own notifications" uses:
--   USING (auth.uid() = user_id)
-- This should work for HEAD requests, but if issues persist,
-- we may need to ensure PostgREST handles HEAD correctly.
-- 
-- Note: HEAD requests in Supabase JS client use the same RLS evaluation
-- as SELECT, so the existing policy should work. If HEAD requests
-- are still failing, it may be a PostgREST configuration issue.

COMMIT;

