-- ============================================================================
-- Serial Number Workflow Verification Script
-- ============================================================================
-- This script verifies that the post_sales_invoice RPC correctly handles
-- serial-tracked products by marking serials as 'used' when posting invoices.
--
-- PREREQUISITES:
-- 1. A serial-tracked product with available serials
-- 2. A finalized invoice with that product
-- 3. Serial numbers linked to invoice items via invoice_item_serials
--
-- USAGE:
-- 1. Set the variables below to match your test data
-- 2. Run STEP 1-3 to verify baseline state
-- 3. Post the invoice via UI or API
-- 4. Run STEP 4-6 to verify final state
-- ============================================================================

-- ============================================================================
-- CONFIGURATION: Set these variables to match your test scenario
-- ============================================================================
\set invoice_id 'YOUR_INVOICE_ID_HERE'
\set org_id 'YOUR_ORG_ID_HERE'
\set test_serial_number 'YOUR_SERIAL_NUMBER_HERE'

-- ============================================================================
-- STEP 1: BASELINE - Check serial status BEFORE posting invoice
-- ============================================================================
-- Expected: Serial should be 'available' or 'reserved' (if invoice finalized)
SELECT 
  'BASELINE CHECK' as step,
  ps.serial_number,
  ps.status as serial_status,
  p.name as product_name,
  p.serial_tracked,
  i.status as invoice_status,
  i.id as invoice_id
FROM public.product_serials ps
JOIN public.products p ON p.id = ps.product_id
LEFT JOIN public.invoice_item_serials iis ON iis.serial_number = ps.serial_number
LEFT JOIN public.invoice_items ii ON ii.id = iis.invoice_item_id
LEFT JOIN public.invoices i ON i.id = ii.invoice_id
WHERE ps.serial_number = :'test_serial_number'
  AND ps.org_id = :'org_id';

-- ============================================================================
-- STEP 2: BASELINE - Check invoice_item_serials linkage
-- ============================================================================
-- Expected: If invoice is finalized, serials should be 'reserved' in invoice_item_serials
SELECT 
  'INVOICE SERIAL LINKAGE' as step,
  iis.serial_number,
  iis.status as linkage_status,
  iis.invoice_item_id,
  ii.quantity,
  i.status as invoice_status
FROM public.invoice_item_serials iis
JOIN public.invoice_items ii ON ii.id = iis.invoice_item_id
JOIN public.invoices i ON i.id = ii.invoice_id
WHERE i.id = :'invoice_id'
  AND i.org_id = :'org_id'
ORDER BY iis.serial_number;

-- ============================================================================
-- STEP 3: BASELINE - Check stock ledger BEFORE posting
-- ============================================================================
-- Expected: Count current stock ledger entries for the product
SELECT 
  'STOCK LEDGER BASELINE' as step,
  p.name as product_name,
  COUNT(*) FILTER (WHERE sl.transaction_type = 'out') as out_transactions_before,
  COUNT(*) FILTER (WHERE sl.transaction_type = 'in') as in_transactions_before,
  COALESCE(SUM(
    CASE 
      WHEN sl.transaction_type = 'in' THEN sl.quantity
      WHEN sl.transaction_type = 'out' THEN -sl.quantity
      WHEN sl.transaction_type = 'adjustment' THEN sl.quantity
      ELSE 0
    END
  ), 0) as current_stock
FROM public.invoice_items ii
JOIN public.invoices i ON i.id = ii.invoice_id
JOIN public.products p ON p.master_product_id = ii.product_id AND p.org_id = i.org_id
LEFT JOIN public.stock_ledger sl ON sl.product_id = p.id AND sl.org_id = i.org_id
WHERE i.id = :'invoice_id'
  AND i.org_id = :'org_id'
GROUP BY p.id, p.name;

-- ============================================================================
-- ACTION: Post the invoice via UI or API
-- Call: post_sales_invoice(p_invoice_id, p_org_id, p_user_id)
-- ============================================================================

-- ============================================================================
-- STEP 4: VERIFICATION - Check invoice status AFTER posting
-- ============================================================================
-- Expected: Invoice status should be 'posted'
SELECT 
  'INVOICE STATUS CHECK' as step,
  id as invoice_id,
  invoice_number,
  status,
  updated_at
FROM public.invoices
WHERE id = :'invoice_id'
  AND org_id = :'org_id';

-- ============================================================================
-- STEP 5: VERIFICATION - Check serial status AFTER posting
-- ============================================================================
-- Expected: Serial status should be 'used' in product_serials
SELECT 
  'SERIAL STATUS CHECK' as step,
  ps.serial_number,
  ps.status as serial_status,
  ps.updated_at,
  p.name as product_name
FROM public.product_serials ps
JOIN public.products p ON p.id = ps.product_id
WHERE ps.serial_number = :'test_serial_number'
  AND ps.org_id = :'org_id';

-- ============================================================================
-- STEP 6: VERIFICATION - Check invoice_item_serials status AFTER posting
-- ============================================================================
-- Expected: All linked serials should be 'used' in invoice_item_serials
SELECT 
  'INVOICE SERIAL LINKAGE CHECK' as step,
  iis.serial_number,
  iis.status as linkage_status,
  iis.used_at,
  iis.invoice_item_id,
  ii.quantity
FROM public.invoice_item_serials iis
JOIN public.invoice_items ii ON ii.id = iis.invoice_item_id
JOIN public.invoices i ON i.id = ii.invoice_id
WHERE i.id = :'invoice_id'
  AND i.org_id = :'org_id'
ORDER BY iis.serial_number;

-- ============================================================================
-- STEP 7: VERIFICATION - Check stock ledger AFTER posting
-- ============================================================================
-- Expected: New 'out' transaction should exist for the product
SELECT 
  'STOCK LEDGER CHECK' as step,
  sl.id,
  sl.transaction_type,
  sl.quantity,
  sl.notes,
  sl.created_at,
  p.name as product_name
FROM public.stock_ledger sl
JOIN public.products p ON p.id = sl.product_id
JOIN public.invoice_items ii ON ii.product_id = p.master_product_id
JOIN public.invoices i ON i.id = ii.invoice_id
WHERE i.id = :'invoice_id'
  AND i.org_id = :'org_id'
  AND sl.transaction_type = 'out'
  AND sl.notes LIKE '%invoice%'
ORDER BY sl.created_at DESC
LIMIT 5;

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- All checks should pass:
-- ✓ Invoice status changed from 'finalized' to 'posted'
-- ✓ Serial status changed from 'available'/'reserved' to 'used' in product_serials
-- ✓ Serial status changed from 'reserved' to 'used' in invoice_item_serials
-- ✓ Stock ledger has new 'out' transaction
-- ============================================================================

