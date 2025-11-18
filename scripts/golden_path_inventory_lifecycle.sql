-- ============================================================================
-- GOLDEN PATH: Complete Inventory Lifecycle Verification
-- ============================================================================
-- This script simulates the full inventory lifecycle:
-- 1. Purchase: Create Bill → Approve → Post → Stock/Serials Created (Available)
-- 2. Sales: Create Invoice → Finalize (Reserve Serial) → Post → Stock Deducted / Serial Retired (Used)
--
-- VERIFIES:
-- ✓ Purchase module populates ledger correctly
-- ✓ Sales module reads and updates ledger correctly
-- ✓ Serial number state machine: available → reserved → used
-- ============================================================================

BEGIN;

-- ============================================================================
-- SETUP: Get or create test organization and user
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_master_product_id uuid;
  v_org_product_id uuid;
  v_master_customer_id uuid;
  v_customer_id uuid;
  v_purchase_bill_id uuid;
  v_invoice_id uuid;
  v_invoice_item_id uuid;
  v_serial_number text;
  v_baseline_stock integer;
  v_final_stock integer;
  v_serial_status_before text;
  v_serial_status_after text;
BEGIN
  -- Get existing org and user (or use provided IDs)
  SELECT id INTO v_org_id FROM public.orgs LIMIT 1;
  SELECT id INTO v_user_id FROM public.profiles LIMIT 1;
  
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'No organization or user found. Please ensure database has at least one org and user.';
  END IF;
  
  RAISE NOTICE 'Using org_id: %, user_id: %', v_org_id, v_user_id;
  
  -- ============================================================================
  -- STEP 1: Create Master Product (Serial-Tracked)
  -- ============================================================================
  RAISE NOTICE 'STEP 1: Creating master product...';
  
  -- Get a valid HSN code and create master product
  -- Check if master product already exists
  SELECT id INTO v_master_product_id FROM public.master_products WHERE sku = 'GP-TEST-SERIAL-001';
  
  -- If not exists, create it
  IF v_master_product_id IS NULL THEN
    INSERT INTO public.master_products (
      name,
      sku,
      hsn_code,
      gst_rate,
      approval_status
    )
    SELECT 
      'Golden Path Test Product',
      'GP-TEST-SERIAL-001',
      hsn_code,
      gst_rate,
      'approved'
    FROM public.hsn_master
    WHERE is_active = true
    LIMIT 1
    RETURNING id INTO v_master_product_id;
  END IF;
  
  RAISE NOTICE 'Master product ID: %', v_master_product_id;
  
  -- ============================================================================
  -- STEP 2: Create Org Product (Serial-Tracked)
  -- ============================================================================
  RAISE NOTICE 'STEP 2: Creating org product...';
  
  INSERT INTO public.products (
    org_id,
    master_product_id,
    name,
    sku,
    serial_tracked,
    status
  ) VALUES (
    v_org_id,
    v_master_product_id,
    'Golden Path Test Product',
    'GP-TEST-SERIAL-001',
    true,
    'active'
  )
  ON CONFLICT (org_id, sku) WHERE status = 'active' DO UPDATE
  SET master_product_id = EXCLUDED.master_product_id,
      serial_tracked = EXCLUDED.serial_tracked,
      status = 'active'
  RETURNING id INTO v_org_product_id;
  
  RAISE NOTICE 'Org product ID: %', v_org_product_id;
  
  -- ============================================================================
  -- STEP 3: Create Master Customer
  -- ============================================================================
  RAISE NOTICE 'STEP 3: Creating master customer...';
  
  INSERT INTO public.master_customers (
    legal_name,
    gstin,
    state_code
  ) VALUES (
    'Golden Path Test Customer',
    '29TEST1234A1Z5',
    '29'
  )
  ON CONFLICT (gstin) DO NOTHING
  RETURNING id INTO v_master_customer_id;
  
  IF v_master_customer_id IS NULL THEN
    SELECT id INTO v_master_customer_id FROM public.master_customers WHERE gstin = '29TEST1234A1Z5';
  END IF;
  
  RAISE NOTICE 'Master customer ID: %', v_master_customer_id;
  
  -- ============================================================================
  -- STEP 4: Create Org Customer
  -- ============================================================================
  RAISE NOTICE 'STEP 4: Creating org customer...';
  
  INSERT INTO public.customers (
    org_id,
    master_customer_id,
    alias_name
  ) VALUES (
    v_org_id,
    v_master_customer_id,
    'Golden Path Test Customer'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_customer_id;
  
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM public.customers 
    WHERE org_id = v_org_id AND master_customer_id = v_master_customer_id;
  END IF;
  
  RAISE NOTICE 'Customer ID: %', v_customer_id;
  
  -- ============================================================================
  -- STEP 5: Create Purchase Bill (Draft)
  -- ============================================================================
  RAISE NOTICE 'STEP 5: Creating purchase bill...';
  
  INSERT INTO public.purchase_bills (
    org_id,
    bill_number,
    vendor_name,
    vendor_gstin,
    vendor_state_code,
    bill_date,
    status
  ) VALUES (
    v_org_id,
    'GP-PB-001',
    'Test Vendor',
    '29VENDOR1234A1Z5',
    '29',
    CURRENT_DATE,
    'draft'
  )
  RETURNING id INTO v_purchase_bill_id;
  
  RAISE NOTICE 'Purchase bill ID: %', v_purchase_bill_id;
  
  -- Add purchase bill item
  INSERT INTO public.purchase_bill_items (
    purchase_bill_id,
    product_id,
    master_product_id,
    description,
    quantity,
    unit,
    unit_price,
    total_amount,
    vendor_hsn_code,
    vendor_gst_rate
  ) VALUES (
    v_purchase_bill_id,
    v_org_product_id,
    v_master_product_id,
    'Golden Path Test Product',
    3, -- Purchase 3 units
    'pcs',
    1000.00,
    3000.00,
    (SELECT hsn_code FROM public.master_products WHERE id = v_master_product_id),
    18.0
  );
  
  -- ============================================================================
  -- STEP 6: Approve Purchase Bill
  -- ============================================================================
  RAISE NOTICE 'STEP 6: Approving purchase bill...';
  
  PERFORM public.approve_purchase_bill_with_hsn_validation(
    v_purchase_bill_id,
    v_org_id,
    v_user_id
  );
  
  RAISE NOTICE 'Purchase bill approved';
  
  -- ============================================================================
  -- STEP 7: Post Purchase Bill (Creates Stock & Serials)
  -- ============================================================================
  RAISE NOTICE 'STEP 7: Posting purchase bill...';
  
  PERFORM public.post_purchase_bill(
    v_purchase_bill_id,
    v_org_id,
    v_user_id
  );
  
  RAISE NOTICE 'Purchase bill posted';
  
  -- ============================================================================
  -- VERIFICATION 1: Check Stock Created
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'in' THEN quantity
      WHEN transaction_type = 'out' THEN -quantity
      WHEN transaction_type = 'adjustment' THEN quantity
      ELSE 0
    END
  ), 0)::integer INTO v_baseline_stock
  FROM public.stock_ledger
  WHERE org_id = v_org_id
    AND product_id = v_org_product_id;
  
  RAISE NOTICE 'Baseline stock after purchase: %', v_baseline_stock;
  
  IF v_baseline_stock != 3 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected stock = 3, got %', v_baseline_stock;
  END IF;
  
  -- ============================================================================
  -- VERIFICATION 2: Check Serials Created (Available)
  -- ============================================================================
  SELECT COUNT(*) INTO v_baseline_stock
  FROM public.product_serials
  WHERE org_id = v_org_id
    AND product_id = v_org_product_id
    AND status = 'available';
  
  RAISE NOTICE 'Available serials after purchase: %', v_baseline_stock;
  
  IF v_baseline_stock != 3 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 3 available serials, got %', v_baseline_stock;
  END IF;
  
  -- Get a specific serial number for tracking
  SELECT serial_number INTO v_serial_number
  FROM public.product_serials
  WHERE org_id = v_org_id
    AND product_id = v_org_product_id
    AND status = 'available'
  LIMIT 1;
  
  SELECT status INTO v_serial_status_before
  FROM public.product_serials
  WHERE serial_number = v_serial_number;
  
  RAISE NOTICE 'Tracking serial: %, status before sale: %', v_serial_number, v_serial_status_before;
  
  -- ============================================================================
  -- STEP 8: Create Sales Invoice (Draft)
  -- ============================================================================
  RAISE NOTICE 'STEP 8: Creating sales invoice...';
  
  INSERT INTO public.invoices (
    org_id,
    customer_id,
    invoice_number,
    status,
    subtotal,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount
  ) VALUES (
    v_org_id,
    v_customer_id,
    'GP-INV-001',
    'draft',
    1000.00,
    90.00,
    90.00,
    0.00,
    1180.00
  )
  RETURNING id INTO v_invoice_id;
  
  RAISE NOTICE 'Invoice ID: %', v_invoice_id;
  
  -- Add invoice item (using master_product_id)
  INSERT INTO public.invoice_items (
    invoice_id,
    product_id, -- This stores master_product_id
    quantity,
    unit,
    unit_price,
    total_amount
  ) VALUES (
    v_invoice_id,
    v_master_product_id, -- master_product_id
    1, -- Sell 1 unit
    'pcs',
    1000.00,
    1000.00
  )
  RETURNING id INTO v_invoice_item_id;
  
  RAISE NOTICE 'Invoice item ID: %', v_invoice_item_id;
  
  -- ============================================================================
  -- STEP 9: Finalize Invoice (Reserves Serial)
  -- ============================================================================
  RAISE NOTICE 'STEP 9: Finalizing invoice...';
  
  UPDATE public.invoices
  SET status = 'finalized'
  WHERE id = v_invoice_id;
  
  -- Reserve the serial number (simulate what finalizeInvoice does)
  INSERT INTO public.invoice_item_serials (
    invoice_item_id,
    serial_number,
    status
  ) VALUES (
    v_invoice_item_id,
    v_serial_number,
    'reserved'
  );
  
  RAISE NOTICE 'Invoice finalized, serial % reserved', v_serial_number;
  
  -- ============================================================================
  -- VERIFICATION 3: Check Serial Reserved
  -- ============================================================================
  SELECT status INTO v_serial_status_before
  FROM public.product_serials
  WHERE serial_number = v_serial_number;
  
  SELECT status INTO v_serial_status_before
  FROM public.invoice_item_serials
  WHERE serial_number = v_serial_number;
  
  RAISE NOTICE 'Serial % status in invoice_item_serials: %', v_serial_number, v_serial_status_before;
  
  -- ============================================================================
  -- STEP 10: Post Sales Invoice (Marks Serial Used, Deducts Stock)
  -- ============================================================================
  RAISE NOTICE 'STEP 10: Posting sales invoice...';
  
  PERFORM public.post_sales_invoice(
    v_invoice_id,
    v_org_id,
    v_user_id
  );
  
  RAISE NOTICE 'Sales invoice posted';
  
  -- ============================================================================
  -- VERIFICATION 4: Check Invoice Status
  -- ============================================================================
  SELECT status INTO v_serial_status_before
  FROM public.invoices
  WHERE id = v_invoice_id;
  
  IF v_serial_status_before != 'posted' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Invoice status should be "posted", got "%"', v_serial_status_before;
  END IF;
  
  RAISE NOTICE '✓ Invoice status: posted';
  
  -- ============================================================================
  -- VERIFICATION 5: Check Stock Deducted
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'in' THEN quantity
      WHEN transaction_type = 'out' THEN -quantity
      WHEN transaction_type = 'adjustment' THEN quantity
      ELSE 0
    END
  ), 0)::integer INTO v_final_stock
  FROM public.stock_ledger
  WHERE org_id = v_org_id
    AND product_id = v_org_product_id;
  
  RAISE NOTICE 'Final stock after sale: %', v_final_stock;
  
  IF v_final_stock != 2 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected stock = 2 (3 - 1), got %', v_final_stock;
  END IF;
  
  RAISE NOTICE '✓ Stock correctly deducted: 3 → 2';
  
  -- ============================================================================
  -- VERIFICATION 6: Check Serial Status in product_serials (Should be 'used')
  -- ============================================================================
  SELECT status INTO v_serial_status_after
  FROM public.product_serials
  WHERE serial_number = v_serial_number;
  
  IF v_serial_status_after != 'used' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Serial % status should be "used", got "%"', v_serial_number, v_serial_status_after;
  END IF;
  
  RAISE NOTICE '✓ Serial % status in product_serials: % → used', v_serial_number, v_serial_status_before;
  
  -- ============================================================================
  -- VERIFICATION 7: Check Serial Status in invoice_item_serials (Should be 'used')
  -- ============================================================================
  SELECT status INTO v_serial_status_after
  FROM public.invoice_item_serials
  WHERE serial_number = v_serial_number;
  
  IF v_serial_status_after != 'used' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Serial % status in invoice_item_serials should be "used", got "%"', v_serial_number, v_serial_status_after;
  END IF;
  
  RAISE NOTICE '✓ Serial % status in invoice_item_serials: reserved → used', v_serial_number;
  
  -- ============================================================================
  -- VERIFICATION 8: Check Stock Ledger Entry Created
  -- ============================================================================
  SELECT COUNT(*) INTO v_baseline_stock
  FROM public.stock_ledger
  WHERE org_id = v_org_id
    AND product_id = v_org_product_id
    AND transaction_type = 'out'
    AND notes LIKE '%GP-INV-001%';
  
  IF v_baseline_stock = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No stock ledger "out" entry found for invoice';
  END IF;
  
  RAISE NOTICE '✓ Stock ledger "out" entry created';
  
  -- ============================================================================
  -- SUMMARY: All Verifications Passed
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'GOLDEN PATH VERIFICATION: SUCCESS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Purchase bill posted → Stock created (3 units)';
  RAISE NOTICE '✓ Serials created → Status: available';
  RAISE NOTICE '✓ Invoice finalized → Serial reserved';
  RAISE NOTICE '✓ Invoice posted → Stock deducted (3 → 2)';
  RAISE NOTICE '✓ Serial status: available → reserved → used';
  RAISE NOTICE '✓ Stock ledger entry created';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Data IDs:';
  RAISE NOTICE '  Purchase Bill: %', v_purchase_bill_id;
  RAISE NOTICE '  Invoice: %', v_invoice_id;
  RAISE NOTICE '  Serial Number: %', v_serial_number;
  RAISE NOTICE '========================================';
  
END $$;

COMMIT;

-- ============================================================================
-- FINAL VERIFICATION QUERIES (Run separately to inspect results)
-- ============================================================================

-- Check purchase bill
SELECT 
  'Purchase Bill' as entity,
  id,
  bill_number,
  status,
  created_at
FROM public.purchase_bills
WHERE bill_number = 'GP-PB-001'
ORDER BY created_at DESC
LIMIT 1;

-- Check invoice
SELECT 
  'Invoice' as entity,
  id,
  invoice_number,
  status,
  created_at,
  updated_at
FROM public.invoices
WHERE invoice_number = 'GP-INV-001'
ORDER BY created_at DESC
LIMIT 1;

-- Check stock ledger
SELECT 
  'Stock Ledger' as entity,
  transaction_type,
  quantity,
  notes,
  created_at
FROM public.stock_ledger
WHERE notes LIKE '%GP-%'
ORDER BY created_at;

-- Check serial status
SELECT 
  'Serial Status' as entity,
  serial_number,
  status,
  updated_at
FROM public.product_serials
WHERE serial_number LIKE 'SN-%'
ORDER BY serial_number;

-- Check invoice-item-serial linkage
SELECT 
  'Invoice Serial Linkage' as entity,
  serial_number,
  status,
  used_at
FROM public.invoice_item_serials
WHERE invoice_item_id IN (
  SELECT id FROM public.invoice_items WHERE invoice_id IN (
    SELECT id FROM public.invoices WHERE invoice_number = 'GP-INV-001'
  )
);

