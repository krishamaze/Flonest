-- Migration: Update master_products RLS policies
-- Drops old conflicting policies and creates new governance-aware policies

BEGIN;

-- CRITICAL: Drop BOTH existing conflicting policies
DROP POLICY IF EXISTS "master_products_read" ON master_products;
DROP POLICY IF EXISTS "Master products: All authenticated users can read active" ON master_products;

-- Policy 1: Public read - Only approved + active products visible to all org users
CREATE POLICY "master_products_read_approved" ON master_products
FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND status = 'active' 
  AND approval_status = 'approved'
);

-- Policy 2: Internal users - Can see ALL master products (including pending, rejected, inactive)
CREATE POLICY "master_products_read_internal" ON master_products
FOR SELECT
USING (
  is_internal_user(auth.uid())
);

-- Policy 3: Org users - Can see their own pending/auto_pass/rejected submissions
CREATE POLICY "master_products_read_own_pending" ON master_products
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND approval_status IN ('pending', 'auto_pass', 'rejected')
  AND submitted_org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- INSERT policy: Direct INSERT blocked by RLS (no policy)
-- All inserts must go through RPC functions (submit_master_product_suggestion, auto_link_product_to_master)

-- UPDATE policy 1: Internal users - Full update access
CREATE POLICY "master_products_update_internal" ON master_products
FOR UPDATE
USING (is_internal_user(auth.uid()))
WITH CHECK (is_internal_user(auth.uid()));

-- UPDATE policy 2: Org users - Can only cancel their own pending (set status='inactive')
CREATE POLICY "master_products_update_own_pending" ON master_products
FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND approval_status = 'pending'
  AND submitted_org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  -- Only allow setting status to 'inactive' (cancel submission)
  status = 'inactive'
  AND approval_status = 'pending' -- Cannot change approval_status
  AND submitted_org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- DELETE policy: Blocked (no policy = no direct deletes)
-- Deletes must go through RPC or service role

COMMIT;

