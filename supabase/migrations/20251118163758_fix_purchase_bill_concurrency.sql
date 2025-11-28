-- Fix Purchase Bill Posting Concurrency Vulnerability
-- 
-- SECURITY: Adds row-level locking to prevent double-posting race conditions
-- 
-- ISSUES FIXED:
-- 1. Missing FOR UPDATE lock: Two users could post same approved bill simultaneously
-- 2. Missing status predicate: UPDATE didn't verify status='approved' before changing
-- 
-- FIXES:
-- 1. Add FOR UPDATE to bill SELECT (mirrors post_sales_invoice pattern)
-- 2. Add status='approved' predicate to UPDATE WHERE clause (defense in depth)

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

  -- Step 1: Fetch and LOCK bill row (concurrency protection)
  -- CRITICAL: FOR UPDATE prevents concurrent posting by blocking second transaction
  SELECT * INTO v_bill
  FROM public.purchase_bills
  WHERE id = p_bill_id
    AND org_id = p_org_id
  FOR UPDATE; -- Row-level lock prevents race conditions

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
  -- CRITICAL: Add status='approved' predicate to catch race conditions at DB level
  -- Defense in depth: Even if FOR UPDATE lock is bypassed, this prevents double-posting
  UPDATE public.purchase_bills
  SET
    status = 'posted',
    posted_at = now(),
    posted_by = p_user_id,
    updated_at = now()
  WHERE id = p_bill_id
    AND org_id = p_org_id
    AND status = 'approved'; -- CRITICAL: Prevents double-posting if lock is bypassed

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update purchase bill status. Bill may have been posted by another user or status changed.';
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

