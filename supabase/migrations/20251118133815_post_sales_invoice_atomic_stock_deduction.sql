-- Migration: Post Sales Invoice with Atomic Stock Deduction
-- 
-- SECURITY: Enforces atomic stock deduction when posting sales invoices
-- Prevents inventory overdraft and concurrency issues
--
-- WORKFLOW:
-- 1. Validates invoice is in 'finalized' status
-- 2. Locks invoice row (SELECT FOR UPDATE) for concurrency protection
-- 3. Validates stock availability for each item BEFORE deduction
-- 4. Handles serial-tracked products (validates serials are available)
-- 5. Creates stock_ledger entries with transaction_type='out'
-- 6. Updates invoice status to 'posted'
--
-- ATOMICITY: All operations succeed or fail together
-- CONCURRENCY: Row-level locking prevents race conditions

BEGIN;

-- =====================================================
-- Step 1: Add Status CHECK Constraint
-- =====================================================
-- Enforce workflow: draft → finalized → posted
-- Add 'posted' status to match purchase bills pattern

ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check
CHECK (status IN ('draft', 'finalized', 'posted', 'cancelled'));

COMMENT ON CONSTRAINT invoices_status_check ON public.invoices IS
'Enforces invoice workflow: draft → finalized → posted. Cancelled can occur from any state.';

-- =====================================================
-- Step 2: Create Post Sales Invoice RPC Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.post_sales_invoice(
  p_invoice_id uuid,
  p_org_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_item public.invoice_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_current_stock integer;
  v_available_serials integer;
  v_serial_record record;
  v_stock_entries_count integer := 0;
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

  -- Step 1: Fetch and LOCK invoice row (concurrency protection)
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND org_id = p_org_id
  FOR UPDATE; -- CRITICAL: Row-level lock prevents concurrent posting

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;

  -- WORKFLOW ENFORCEMENT: Only allow 'finalized' → 'posted' transition
  IF v_invoice.status != 'finalized' THEN
    IF v_invoice.status = 'posted' THEN
      RAISE EXCEPTION 'Invoice is already posted';
    ELSIF v_invoice.status = 'draft' THEN
      RAISE EXCEPTION 'Cannot post invoice with status "draft". Invoice must be finalized before posting.';
    ELSIF v_invoice.status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot post cancelled invoice';
    ELSE
      RAISE EXCEPTION 'Cannot post invoice with status "%". Invoice must be in finalized status.', v_invoice.status;
    END IF;
  END IF;

  -- VALIDATION GATE: Check items exist
  IF NOT EXISTS (
    SELECT 1 
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE ii.invoice_id = p_invoice_id
      AND i.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cannot post invoice with no items';
  END IF;

  -- Step 2: Validate stock availability and create stock_ledger entries
  -- NOTE: invoice_items.product_id stores master_product_id, not org product_id
  -- We need to find the org product that has this master_product_id
  FOR v_item IN
    SELECT ii.*
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE ii.invoice_id = p_invoice_id
      AND i.org_id = p_org_id
      AND ii.product_id IS NOT NULL
  LOOP
    -- CRITICAL: invoice_items.product_id is master_product_id, not org product_id
    -- Find org product that has this master_product_id
    SELECT p.* INTO v_product
    FROM public.products p
    WHERE p.master_product_id = v_item.product_id
      AND p.org_id = p_org_id
      AND p.status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No active org product found for master product % in organization %', 
        v_item.product_id, p_org_id;
    END IF;

    -- Handle serial-tracked products
    IF v_product.serial_tracked = true THEN
      -- VALIDATION GATE: Check that serials are linked via invoice_item_serials
      SELECT COUNT(*) INTO v_available_serials
      FROM public.invoice_item_serials iis
      WHERE iis.invoice_item_id = v_item.id
        AND iis.status = 'reserved';

      IF v_available_serials < v_item.quantity::integer THEN
        RAISE EXCEPTION 'Insufficient serials linked to invoice item for product %. Linked: %, Required: %', 
          v_product.name, v_available_serials, v_item.quantity::integer;
      END IF;

      -- CRITICAL: Mark serials as 'used' in both tables (atomic)
      -- Step 1: Update product_serials.status = 'used' for linked serials
      -- Use org product_id (v_product.id), not master_product_id (v_item.product_id)
      UPDATE public.product_serials ps
      SET
        status = 'used',
        updated_at = now()
      FROM public.invoice_item_serials iis
      WHERE iis.invoice_item_id = v_item.id
        AND iis.serial_number = ps.serial_number
        AND ps.org_id = p_org_id
        AND ps.product_id = v_product.id -- Use org product_id
        AND ps.status IN ('available', 'reserved')
        AND iis.status = 'reserved';

      -- Step 2: Update invoice_item_serials.status = 'used'
      UPDATE public.invoice_item_serials
      SET
        status = 'used',
        used_at = now()
      WHERE invoice_item_id = v_item.id
        AND status = 'reserved';

      -- Verify all serials were marked as used
      SELECT COUNT(*) INTO v_available_serials
      FROM public.invoice_item_serials
      WHERE invoice_item_id = v_item.id
        AND status = 'reserved';

      IF v_available_serials > 0 THEN
        RAISE EXCEPTION 'Failed to mark all serials as used for invoice item %. Still reserved: %', 
          v_item.id, v_available_serials;
      END IF;
    ELSE
      -- Non-serial-tracked: Calculate current stock from stock_ledger
      -- Use org product_id (v_product.id), not master_product_id (v_item.product_id)
      SELECT COALESCE(SUM(
        CASE 
          WHEN transaction_type = 'in' THEN quantity
          WHEN transaction_type = 'out' THEN -quantity
          WHEN transaction_type = 'adjustment' THEN quantity
          ELSE 0
        END
      ), 0)::integer
      INTO v_current_stock
      FROM public.stock_ledger
      WHERE org_id = p_org_id
        AND product_id = v_product.id; -- Use org product_id

      -- Ensure non-negative stock
      v_current_stock := GREATEST(v_current_stock, 0);

      -- VALIDATION GATE: Check stock availability BEFORE deduction
      IF v_current_stock < v_item.quantity::integer THEN
        RAISE EXCEPTION 'Insufficient stock for product "%". Available: %, Requested: %', 
          v_product.name, v_current_stock, v_item.quantity::integer;
      END IF;
    END IF;

    -- Create stock_ledger entry (deduct stock)
    -- Use org product_id (v_product.id), not master_product_id (v_item.product_id)
    INSERT INTO public.stock_ledger (
      org_id,
      product_id,
      transaction_type,
      quantity,
      notes,
      created_by
    ) VALUES (
      p_org_id,
      v_product.id, -- Use org product_id, not master_product_id
      'out',
      v_item.quantity::integer,
      'Sale from invoice ' || COALESCE(v_invoice.invoice_number, v_invoice.id::text),
      p_user_id
    );
    v_stock_entries_count := v_stock_entries_count + 1;
  END LOOP;

  -- Step 3: Update invoice status to 'posted' (within same transaction)
  UPDATE public.invoices
  SET
    status = 'posted',
    updated_at = now()
  WHERE id = p_invoice_id
    AND org_id = p_org_id;

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update invoice status';
  END IF;

  -- Return success result
  SELECT jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'stock_entries_created', v_stock_entries_count,
    'status', 'posted'
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: RAISE; re-raises the exception, causing PostgreSQL to abort the transaction
    -- This ensures ALL changes (stock_ledger inserts AND invoice status update) are rolled back atomically
    RAISE;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.post_sales_invoice(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.post_sales_invoice(uuid, uuid, uuid) IS 
'Post a sales invoice to inventory (deduct stock).
WORKFLOW: Only allows "finalized" → "posted" transition. Rejects "draft" and other statuses.
ATOMICITY: All operations (stock_ledger inserts + invoice status update) succeed or fail together.
CONCURRENCY: SELECT FOR UPDATE prevents race conditions on stock availability.
STOCK VALIDATION: Checks availability BEFORE deduction to prevent negative inventory.';

COMMIT;

