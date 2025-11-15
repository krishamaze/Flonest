-- Migration: Update reviewer RPC functions to require AAL2
-- CRITICAL: RPC functions currently only check is_internal_user(), allowing bypass without MFA
--
-- Security risk:
-- - review_master_product() can be called by platform admin without completing MFA
-- - Direct API calls bypass UI MFA checks
--
-- This migration:
-- 1. Updates review_master_product() to require AAL2 via require_platform_admin_aal2()
-- 2. Ensures server-side enforcement matches RLS policies

BEGIN;

-- Update review_master_product RPC to require AAL2
CREATE OR REPLACE FUNCTION review_master_product(
  p_master_product_id uuid,
  p_action text,
  p_reviewer_id uuid,
  p_changes jsonb DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_hsn_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_product master_products%ROWTYPE;
  v_previous_approval_status text;
  v_gst_rate numeric;
  v_success boolean := false;
BEGIN
  -- Validate user is platform admin AND has AAL2 (MFA verified)
  -- This matches the RLS policy requirement
  IF NOT require_platform_admin_aal2() THEN
    RAISE EXCEPTION 'Access denied: Platform admin with MFA (AAL2) required';
  END IF;
  
  -- Also validate reviewer_id matches current user (defense in depth)
  IF p_reviewer_id != auth.uid() THEN
    RAISE EXCEPTION 'Reviewer ID must match authenticated user';
  END IF;

  -- Validate action
  IF p_action NOT IN ('approve', 'reject', 'edit_and_approve') THEN
    RAISE EXCEPTION 'Invalid action. Must be approve, reject, or edit_and_approve';
  END IF;

  -- Fetch master product
  SELECT * INTO v_master_product
  FROM master_products
  WHERE id = p_master_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master product not found';
  END IF;

  -- Store previous approval status
  v_previous_approval_status := v_master_product.approval_status;

  -- Handle different actions
  IF p_action = 'approve' OR p_action = 'edit_and_approve' THEN
    -- Validate HSN code is required for approval
    IF p_hsn_code IS NULL THEN
      RAISE EXCEPTION 'HSN code is required for approval';
    END IF;

    -- Validate HSN code exists in hsn_master
    IF NOT EXISTS (SELECT 1 FROM hsn_master WHERE hsn_code = p_hsn_code AND is_active = true) THEN
      RAISE EXCEPTION 'HSN code does not exist in hsn_master table';
    END IF;

    -- Get GST rate from hsn_master
    SELECT gst_rate INTO v_gst_rate
    FROM hsn_master
    WHERE hsn_code = p_hsn_code AND is_active = true;

    -- Apply changes if provided (for edit_and_approve)
    IF p_changes IS NOT NULL THEN
      -- Update fields from p_changes
      UPDATE master_products
      SET
        name = COALESCE((p_changes->>'name')::text, name),
        category = COALESCE((p_changes->>'category')::text, category),
        base_unit = COALESCE((p_changes->>'base_unit')::text, base_unit),
        base_price = COALESCE((p_changes->>'base_price')::numeric, base_price),
        barcode_ean = COALESCE((p_changes->>'barcode_ean')::text, barcode_ean),
        updated_at = NOW()
      WHERE id = p_master_product_id;
    END IF;

    -- Approve the product
    UPDATE master_products
    SET
      approval_status = 'approved',
      status = 'active',
      hsn_code = p_hsn_code,
      gst_rate = v_gst_rate, -- Store for backward compatibility, but should use hsn_master
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE id = p_master_product_id;

    v_success := true;

  ELSIF p_action = 'reject' THEN
    -- Validate rejection reason
    IF p_note IS NULL OR TRIM(p_note) = '' THEN
      RAISE EXCEPTION 'Rejection reason is required';
    END IF;

    -- Reject the product
    UPDATE master_products
    SET
      approval_status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      rejection_reason = p_note,
      updated_at = NOW()
    WHERE id = p_master_product_id;

    v_success := true;
  END IF;

  -- Log review action
  INSERT INTO master_product_reviews (
    master_product_id,
    action,
    reviewed_by,
    reviewed_at,
    note,
    field_changes,
    previous_approval_status,
    new_approval_status
  )
  VALUES (
    p_master_product_id,
    p_action,
    p_reviewer_id,
    NOW(),
    p_note,
    p_changes,
    v_previous_approval_status,
    (SELECT approval_status FROM master_products WHERE id = p_master_product_id)
  );

  RETURN v_success;
END;
$$;

-- Update comment
COMMENT ON FUNCTION review_master_product(uuid, text, uuid, jsonb, text, text) IS 
'Review master product (approve/reject/edit). 
SECURITY: Requires platform_admin flag AND AAL2 (MFA verified) session.
Server-side enforcement matches RLS policies.';

COMMIT;

