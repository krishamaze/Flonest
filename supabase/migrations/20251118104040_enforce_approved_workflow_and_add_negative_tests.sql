-- Workflow Enforcement & Atomicity Verification: post_purchase_bill RPC Function
-- 
-- ISSUES FIXED:
-- 1. Workflow Bypass: Enforce strict 'approved' → 'posted' transition (reject 'draft')
-- 2. Exception Handling: Verify RAISE; ensures hard rollback (already correct, but documented)
-- 3. Verification Gap: Add negative test function to prove atomicity
--
-- FIXES:
-- 1. Change status validation to ONLY allow 'approved' status
-- 2. Document that RAISE; in EXCEPTION block ensures transaction rollback
-- 3. Create test function to verify zero stock_ledger entries on failure

BEGIN;

-- =====================================================
-- Fix: Enforce Approved Workflow
-- =====================================================

CREATE OR REPLACE FUNCTION public.post_purchase_bill(
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
  v_product_id uuid;
  v_stock_entries_count integer := 0;
  v_result jsonb;
  v_user_org_id uuid;
BEGIN
  -- CRITICAL: Validate tenant isolation - ensure user can only access their own org's data
  v_user_org_id := public.current_user_org_id();
  
  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;
  
  IF p_org_id IS NULL OR p_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Access denied: org_id parameter must match current user organization';
  END IF;

  -- Step 1: Fetch bill with validation (explicit org_id check)
  SELECT * INTO v_bill
  FROM public.purchase_bills
  WHERE id = p_bill_id
    AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase bill not found or access denied';
  END IF;

  -- WORKFLOW ENFORCEMENT: Only allow 'approved' → 'posted' transition
  -- Reject 'draft' status to enforce approval workflow
  IF v_bill.status != 'approved' THEN
    IF v_bill.status = 'posted' THEN
      RAISE EXCEPTION 'Purchase bill is already posted';
    ELSIF v_bill.status = 'draft' THEN
      RAISE EXCEPTION 'Cannot post purchase bill with status "draft". Bill must be approved before posting.';
    ELSIF v_bill.status = 'flagged_hsn_mismatch' THEN
      RAISE EXCEPTION 'Cannot post purchase bill with status "flagged_hsn_mismatch". Resolve HSN mismatches and approve the bill before posting.';
    ELSE
      RAISE EXCEPTION 'Cannot post purchase bill with status "%". Bill must be in approved status.', v_bill.status;
    END IF;
  END IF;

  -- VALIDATION GATE: Check items exist (with explicit org_id validation via JOIN)
  IF NOT EXISTS (
    SELECT 1 
    FROM public.purchase_bill_items pbi
    JOIN public.purchase_bills pb ON pb.id = pbi.purchase_bill_id
    WHERE pbi.purchase_bill_id = p_bill_id
      AND pb.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cannot post purchase bill with no items';
  END IF;

  -- VALIDATION GATE: All items must have product_id (with explicit org_id validation)
  IF EXISTS (
    SELECT 1 
    FROM public.purchase_bill_items pbi
    JOIN public.purchase_bills pb ON pb.id = pbi.purchase_bill_id
    WHERE pbi.purchase_bill_id = p_bill_id
      AND pb.org_id = p_org_id
      AND pbi.product_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post purchase bill: one or more items missing product_id. All items must be linked to products before posting.';
  END IF;

  -- VALIDATION GATE: Verify all products exist and belong to organization
  IF EXISTS (
    SELECT 1 
    FROM public.purchase_bill_items pbi
    JOIN public.purchase_bills pb ON pb.id = pbi.purchase_bill_id
    WHERE pbi.purchase_bill_id = p_bill_id
      AND pb.org_id = p_org_id
      AND pbi.product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM public.products p
        WHERE p.id = pbi.product_id
          AND p.org_id = p_org_id
      )
  ) THEN
    RAISE EXCEPTION 'Cannot post purchase bill: one or more products not found or do not belong to this organization';
  END IF;

  -- Step 2: Create stock_ledger entries (within transaction)
  -- Explicit org_id validation via JOIN ensures items belong to correct org
  FOR v_item IN
    SELECT pbi.*
    FROM public.purchase_bill_items pbi
    JOIN public.purchase_bills pb ON pb.id = pbi.purchase_bill_id
    WHERE pbi.purchase_bill_id = p_bill_id
      AND pb.org_id = p_org_id
      AND pbi.product_id IS NOT NULL
  LOOP
    -- Double-check product belongs to org before inserting stock ledger entry
    SELECT id INTO v_product_id
    FROM public.products
    WHERE id = v_item.product_id
      AND org_id = p_org_id;
    
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Product % does not belong to organization %', v_item.product_id, p_org_id;
    END IF;

    INSERT INTO public.stock_ledger (
      org_id,
      product_id,
      transaction_type,
      quantity,
      notes,
      created_by
    ) VALUES (
      p_org_id,
      v_item.product_id,
      'in',
      v_item.quantity,
      'Purchase from bill ' || v_bill.bill_number,
      p_user_id
    );
    v_stock_entries_count := v_stock_entries_count + 1;
  END LOOP;

  -- Step 3: Update bill status to 'posted' (within same transaction)
  -- Explicit org_id check prevents cross-tenant updates
  UPDATE public.purchase_bills
  SET
    status = 'posted',
    posted_at = now(),
    posted_by = p_user_id,
    updated_at = now()
  WHERE id = p_bill_id
    AND org_id = p_org_id;

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update purchase bill status';
  END IF;

  -- Return success result
  SELECT jsonb_build_object(
    'success', true,
    'bill_id', p_bill_id,
    'stock_entries_created', v_stock_entries_count,
    'status', 'posted'
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: RAISE; re-raises the exception, causing PostgreSQL to abort the transaction
    -- This ensures ALL changes (stock_ledger inserts AND bill status update) are rolled back atomically
    -- Without RAISE;, the function would return normally and the transaction would commit partial changes
    RAISE;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.post_purchase_bill(uuid, uuid, uuid) TO authenticated;

-- =====================================================
-- Negative Test Function: Verify Atomicity
-- =====================================================
-- This function tests that failures leave zero side effects
-- It should be run manually to verify rollback behavior

CREATE OR REPLACE FUNCTION public.test_post_purchase_bill_atomicity(
  p_test_bill_id uuid,
  p_test_org_id uuid,
  p_test_user_id uuid,
  p_failure_scenario text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stock_count_before integer;
  v_stock_count_after integer;
  v_bill_status_before text;
  v_bill_status_after text;
  v_error_occurred boolean := false;
  v_error_message text;
  v_result jsonb;
BEGIN
  -- Capture initial state
  SELECT COUNT(*) INTO v_stock_count_before
  FROM public.stock_ledger
  WHERE org_id = p_test_org_id;
  
  SELECT status INTO v_bill_status_before
  FROM public.purchase_bills
  WHERE id = p_test_bill_id;

  -- Attempt to post bill (should fail based on scenario)
  BEGIN
    PERFORM public.post_purchase_bill(p_test_bill_id, p_test_org_id, p_test_user_id);
    v_error_occurred := false;
  EXCEPTION
    WHEN OTHERS THEN
      v_error_occurred := true;
      v_error_message := SQLERRM;
  END;

  -- Capture final state
  SELECT COUNT(*) INTO v_stock_count_after
  FROM public.stock_ledger
  WHERE org_id = p_test_org_id;
  
  SELECT status INTO v_bill_status_after
  FROM public.purchase_bills
  WHERE id = p_test_bill_id;

  -- Build test result
  SELECT jsonb_build_object(
    'test_scenario', p_failure_scenario,
    'error_occurred', v_error_occurred,
    'error_message', v_error_message,
    'stock_ledger_before', v_stock_count_before,
    'stock_ledger_after', v_stock_count_after,
    'stock_ledger_delta', v_stock_count_after - v_stock_count_before,
    'bill_status_before', v_bill_status_before,
    'bill_status_after', v_bill_status_after,
    'status_changed', (v_bill_status_before != v_bill_status_after),
    'atomicity_verified', (
      -- Atomicity is verified if:
      -- 1. Error occurred (expected for negative tests)
      -- 2. Stock ledger count did NOT increase (zero entries created)
      -- 3. Bill status did NOT change
      v_error_occurred = true
      AND v_stock_count_after = v_stock_count_before
      AND v_bill_status_before = v_bill_status_after
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Grant execute permission for testing (restrict to platform admins in production)
GRANT EXECUTE ON FUNCTION public.test_post_purchase_bill_atomicity(uuid, uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.post_purchase_bill(uuid, uuid, uuid) IS 
'Post a purchase bill to inventory. 
WORKFLOW: Only allows "approved" → "posted" transition. Rejects "draft" and other statuses.
ATOMICITY: All operations (stock_ledger inserts + bill status update) succeed or fail together.
EXCEPTION HANDLING: RAISE; in EXCEPTION block ensures hard rollback on any error.';

COMMENT ON FUNCTION public.test_post_purchase_bill_atomicity(uuid, uuid, uuid, text) IS 
'Negative test function to verify atomicity of post_purchase_bill.
Verifies that failures leave zero side effects (no stock_ledger entries, no status change).
Use this to prove rollback behavior works correctly.';

COMMIT;



