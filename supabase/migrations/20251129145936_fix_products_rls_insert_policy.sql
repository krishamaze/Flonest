-- Fix RLS policies for products table to allow INSERT with NULL branch_id
-- 
-- Root Cause: The products_branch_head_all policy requires branch_id = current_user_branch_id()
-- but when creating products, branch_id is NULL, causing INSERT to fail for branch_head users.
--
-- Solution: Add WITH CHECK clause that allows NULL branch_id OR matching branch_id

-- Drop existing policies
DROP POLICY IF EXISTS products_branch_head_all ON public.products;
DROP POLICY IF EXISTS products_owner_all ON public.products;

-- Recreate products_owner_all policy (unchanged, but adding explicit WITH CHECK)
CREATE POLICY products_owner_all
ON public.products
FOR ALL
TO public
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

-- Recreate products_branch_head_all policy with fixed WITH CHECK
CREATE POLICY products_branch_head_all
ON public.products
FOR ALL
TO public
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND branch_id = public.current_user_branch_id()
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND (branch_id IS NULL OR branch_id = public.current_user_branch_id())
);

-- Add comment
COMMENT ON POLICY products_branch_head_all ON public.products IS 
  'Branch heads can manage products in their branch. 
   USING: Can only read/update/delete products in their branch.
   WITH CHECK: Can insert products with NULL branch_id OR their own branch_id.';
