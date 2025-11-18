-- Migration: Approve Purchase Bill with HSN Validation
-- 
-- COMPLIANCE: Enforces HSN code validation during approval
-- Prevents bills with incorrect tax classifications from being approved
--
-- WORKFLOW:
-- 1. Validates bill is in 'draft' status
-- 2. Checks HSN mismatches for all items using check_hsn_mismatch()
-- 3. Updates item hsn_mismatch and hsn_match_status flags
-- 4. Sets bill status:
--    - 'flagged_hsn_mismatch' if ANY items have mismatches
--    - 'approved' if ALL items match (or have no product_id)
-- 5. Sets approved_at and approved_by timestamps
--
-- ATOMICITY: All operations succeed or fail together

BEGIN;

CREATE OR REPLACE FUNCTION public.approve_purchase_bill_with_hsn_validation(
  p_bill_id uuid,
  p_org_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bill public.purchase_bills%ROWTYPE;
  v_item public.purchase_bill_items%ROWTYPE;
  v_hsn_check record;
  v_has_mismatch boolean := false;
  v_items_checked integer := 0;
  v_items_with_mismatch integer := 0;
  v_final_status text;
  v_result jsonb;
  v_user_org_id uuid;
BEGIN
  -- CRITICAL: Validate tenant isolation
  v_user_org_id := public.current_user_org_id();
  
  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;
  
  IF p_org_id IS NULL OR p_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Access denied: org_id parameter must match current user organization';
  END IF;

  -- Step 1: Fetch bill with validation (must be draft)
  SELECT * INTO v_bill
  FROM public.purchase_bills
  WHERE id = p_bill_id
    AND org_id = p_org_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase bill not found, already approved, or access denied';
  END IF;

  -- Step 2: Check HSN mismatches for all items
  FOR v_item IN
    SELECT pbi.*
    FROM public.purchase_bill_items pbi
    JOIN public.purchase_bills pb ON pb.id = pbi.purchase_bill_id
    WHERE pbi.purchase_bill_id = p_bill_id
      AND pb.org_id = p_org_id
  LOOP
    v_items_checked := v_items_checked + 1;

    -- Only check HSN if item has product_id and vendor_hsn_code
    IF v_item.product_id IS NOT NULL AND v_item.vendor_hsn_code IS NOT NULL THEN
      -- Call check_hsn_mismatch function
      SELECT * INTO v_hsn_check
      FROM public.check_hsn_mismatch(v_item.product_id, v_item.vendor_hsn_code);

      -- Update item flags based on check result
      IF v_hsn_check.matches = false THEN
        v_has_mismatch := true;
        v_items_with_mismatch := v_items_with_mismatch + 1;
        
        UPDATE public.purchase_bill_items
        SET
          hsn_mismatch = true,
          hsn_match_status = 'mismatch',
          updated_at = now()
        WHERE id = v_item.id;
      ELSE
        UPDATE public.purchase_bill_items
        SET
          hsn_mismatch = false,
          hsn_match_status = 'match',
          updated_at = now()
        WHERE id = v_item.id;
      END IF;
    ELSE
      -- Item has no product_id or vendor_hsn_code - mark as pending verification
      UPDATE public.purchase_bill_items
      SET
        hsn_mismatch = false,
        hsn_match_status = 'pending_verification',
        updated_at = now()
      WHERE id = v_item.id;
    END IF;
  END LOOP;

  -- Step 3: Determine final status based on mismatch check
  IF v_has_mismatch THEN
    v_final_status := 'flagged_hsn_mismatch';
  ELSE
    v_final_status := 'approved';
  END IF;

  -- Step 4: Update bill status (atomic with item updates)
  UPDATE public.purchase_bills
  SET
    status = v_final_status,
    approved_at = CASE WHEN v_final_status = 'approved' THEN now() ELSE NULL END,
    approved_by = CASE WHEN v_final_status = 'approved' THEN p_user_id ELSE NULL END,
    updated_at = now()
  WHERE id = p_bill_id
    AND org_id = p_org_id;

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update purchase bill status';
  END IF;

  -- Return success result with details
  SELECT jsonb_build_object(
    'success', true,
    'bill_id', p_bill_id,
    'status', v_final_status,
    'items_checked', v_items_checked,
    'items_with_mismatch', v_items_with_mismatch,
    'has_mismatch', v_has_mismatch
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: RAISE; ensures transaction rollback
    RAISE;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.approve_purchase_bill_with_hsn_validation(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.approve_purchase_bill_with_hsn_validation(uuid, uuid, uuid) IS 
'Approve a purchase bill with HSN validation.
COMPLIANCE: Checks HSN mismatches for all items before approval.
WORKFLOW: Sets status to "flagged_hsn_mismatch" if mismatches found, "approved" if all match.
ATOMICITY: All operations (item flag updates + bill status) succeed or fail together.';

COMMIT;

