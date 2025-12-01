-- Migration: Fix broken RLS policies by updating internal user functions to use platform_admin
-- CRITICAL: This fixes the outage where all RLS policies fail because they reference deleted is_internal column
--
-- Background:
-- - Column profiles.is_internal was replaced with profiles.platform_admin in earlier migrations
-- - Functions is_internal_user() and current_user_is_internal() still reference is_internal
-- - All RLS policies calling these functions now error out, blocking tenant access
--
-- This migration:
-- 1. Updates is_internal_user() to check platform_admin instead of is_internal
-- 2. Updates current_user_is_internal() to check platform_admin instead of is_internal
-- 3. All existing policies will automatically work once functions are fixed

BEGIN;

-- Step 1: Fix is_internal_user(user_id uuid) function
-- Used by: master_products RLS, hsn_master RLS, category_map RLS, master_product_reviews RLS, RPC functions
CREATE OR REPLACE FUNCTION is_internal_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT platform_admin FROM profiles WHERE id = user_id), false);
$$;

-- Step 2: Fix current_user_is_internal() function  
-- Used by: memberships RLS, invoices RLS, customers RLS, stock_ledger RLS, products RLS
CREATE OR REPLACE FUNCTION current_user_is_internal()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT platform_admin FROM profiles WHERE id = auth.uid()), false);
$$;

-- Step 3: Verify functions work (will fail if platform_admin column doesn't exist)
DO $$
BEGIN
  -- Test that functions return boolean without errors
  PERFORM is_internal_user('00000000-0000-0000-0000-000000000000'::uuid);
  PERFORM current_user_is_internal();
  
  RAISE NOTICE 'Functions updated successfully - RLS policies should now work';
END $$;

COMMIT;

