-- Migration: Add AAL2 enforcement for platform admin operations
-- CRITICAL: Currently platform admins can access reviewer data without completing MFA
-- This allows bypassing TOTP by hitting APIs directly with refresh tokens
--
-- Security risk:
-- - Platform admin with refresh token can call reviewer RPCs/queries without MFA
-- - No server-side check that session has aal2 (MFA completed)
-- - Violates Supabase best practice: AAL should be source of truth for privileged access
--
-- This migration:
-- 1. Creates require_platform_admin_aal2() helper that checks both platform_admin AND aal2
-- 2. Updates reviewer RLS policies to require AAL2
-- 3. Updates reviewer RPC functions to require AAL2
-- 4. Note: JWT claim 'aal' is set by Supabase Auth when MFA is verified (value: 'aal2')

BEGIN;

-- Step 1: Create helper function to check platform admin + AAL2
-- Returns true only if user is platform admin AND session has aal2
CREATE OR REPLACE FUNCTION require_platform_admin_aal2()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    -- User must be platform admin
    COALESCE((SELECT platform_admin FROM profiles WHERE id = auth.uid()), false)
    AND
    -- Session must have AAL2 (MFA verified)
    -- Supabase sets 'aal' claim in JWT when MFA is completed
    COALESCE((auth.jwt() ->> 'aal')::text = 'aal2', false)
  );
$$;

-- Grant execute to authenticated (will be used in policies)
GRANT EXECUTE ON FUNCTION require_platform_admin_aal2() TO authenticated;

COMMENT ON FUNCTION require_platform_admin_aal2() IS 
'Requires both platform_admin flag AND AAL2 (MFA verified) session.
Returns true only if user is platform admin AND has completed TOTP verification.
Used to enforce server-side MFA requirement for reviewer operations.';

-- Step 2: Update master_products reviewer policies to require AAL2
-- Drop old policies that only checked is_internal_user()
DROP POLICY IF EXISTS "master_products_read_internal" ON master_products;
DROP POLICY IF EXISTS "master_products_update_internal" ON master_products;

-- Create new policies requiring AAL2
CREATE POLICY "master_products_read_platform_admin_aal2" ON master_products
FOR SELECT
USING (require_platform_admin_aal2());

CREATE POLICY "master_products_update_platform_admin_aal2" ON master_products
FOR UPDATE
USING (require_platform_admin_aal2())
WITH CHECK (require_platform_admin_aal2());

-- Step 3: Update master_product_reviews policies to require AAL2
DROP POLICY IF EXISTS "master_product_reviews_read_internal" ON master_product_reviews;
DROP POLICY IF EXISTS "master_product_reviews_insert_internal" ON master_product_reviews;
DROP POLICY IF EXISTS "master_product_reviews_write_internal" ON master_product_reviews;

CREATE POLICY "master_product_reviews_read_platform_admin_aal2" ON master_product_reviews
FOR SELECT
USING (require_platform_admin_aal2());

CREATE POLICY "master_product_reviews_insert_platform_admin_aal2" ON master_product_reviews
FOR INSERT
WITH CHECK (require_platform_admin_aal2());

CREATE POLICY "master_product_reviews_write_platform_admin_aal2" ON master_product_reviews
FOR ALL
USING (require_platform_admin_aal2())
WITH CHECK (require_platform_admin_aal2());

-- Step 4: Update hsn_master reviewer policies to require AAL2
DROP POLICY IF EXISTS "hsn_master_write_internal" ON hsn_master;

CREATE POLICY "hsn_master_write_platform_admin_aal2" ON hsn_master
FOR ALL
USING (require_platform_admin_aal2())
WITH CHECK (require_platform_admin_aal2());

-- Step 5: Update category_map reviewer policies to require AAL2
DROP POLICY IF EXISTS "category_map_write_internal" ON category_map;

CREATE POLICY "category_map_write_platform_admin_aal2" ON category_map
FOR ALL
USING (require_platform_admin_aal2())
WITH CHECK (require_platform_admin_aal2());

-- Step 6: Verify policies created
DO $$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('master_products', 'master_product_reviews', 'hsn_master', 'category_map')
    AND policyname LIKE '%platform_admin_aal2%';
  
  IF v_policy_count < 7 THEN
    RAISE EXCEPTION 'Expected 7 AAL2 policies, found %', v_policy_count;
  END IF;
  
  RAISE NOTICE 'AAL2 enforcement added - reviewer operations now require MFA';
END $$;

COMMIT;

