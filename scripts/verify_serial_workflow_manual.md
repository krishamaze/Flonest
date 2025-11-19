# Serial Number Workflow Verification Guide

## Overview
This guide helps you verify that the `post_sales_invoice` RPC correctly handles serial-tracked products by marking serials as `used` when posting invoices.

## Prerequisites
1. A serial-tracked product with available serials
2. A finalized invoice containing that product
3. Serial numbers linked to invoice items via `invoice_item_serials` table

## Verification Steps

### Step 1: Baseline Check (Before Posting)

**1.1 Check Serial Status**
```sql
SELECT 
  ps.serial_number,
  ps.status,
  p.name as product_name
FROM public.product_serials ps
JOIN public.products p ON p.id = ps.product_id
WHERE ps.serial_number = 'YOUR_SERIAL_NUMBER'
  AND ps.org_id = 'YOUR_ORG_ID';
```
**Expected:** Serial status should be `available` or `reserved` (if invoice is finalized)

**1.2 Check Invoice Status**
```sql
SELECT id, invoice_number, status
FROM public.invoices
WHERE id = 'YOUR_INVOICE_ID';
```
**Expected:** Invoice status should be `finalized`

**1.3 Check Invoice-Item-Serial Linkage**
```sql
SELECT 
  iis.serial_number,
  iis.status,
  ii.quantity
FROM public.invoice_item_serials iis
JOIN public.invoice_items ii ON ii.id = iis.invoice_item_id
WHERE ii.invoice_id = 'YOUR_INVOICE_ID';
```
**Expected:** If invoice is finalized, serials should be `reserved` in `invoice_item_serials`

**1.4 Check Stock Ledger Baseline**
```sql
SELECT COUNT(*) as out_transactions
FROM public.stock_ledger sl
JOIN public.products p ON p.id = sl.product_id
JOIN public.invoice_items ii ON ii.product_id = p.master_product_id
WHERE ii.invoice_id = 'YOUR_INVOICE_ID'
  AND sl.transaction_type = 'out';
```
**Expected:** Count current `out` transactions (baseline for comparison)

---

### Step 2: Action - Post the Invoice

Post the invoice via:
- **UI:** Click "Post to Inventory" button on the invoice details page
- **API:** Call `postSalesInvoice(invoiceId, orgId, userId)`

---

### Step 3: Verification (After Posting)

**3.1 Verify Invoice Status**
```sql
SELECT id, invoice_number, status, updated_at
FROM public.invoices
WHERE id = 'YOUR_INVOICE_ID';
```
**Expected:** Status should be `posted`, `updated_at` should reflect posting time

**3.2 Verify Serial Status in product_serials**
```sql
SELECT 
  ps.serial_number,
  ps.status,
  ps.updated_at
FROM public.product_serials ps
WHERE ps.serial_number = 'YOUR_SERIAL_NUMBER'
  AND ps.org_id = 'YOUR_ORG_ID';
```
**Expected:** Status should be `used`, `updated_at` should reflect posting time

**3.3 Verify Serial Status in invoice_item_serials**
```sql
SELECT 
  iis.serial_number,
  iis.status,
  iis.used_at
FROM public.invoice_item_serials iis
JOIN public.invoice_items ii ON ii.id = iis.invoice_item_id
WHERE ii.invoice_id = 'YOUR_INVOICE_ID';
```
**Expected:** All serials should be `used`, `used_at` should be set

**3.4 Verify Stock Ledger Entry**
```sql
SELECT 
  sl.transaction_type,
  sl.quantity,
  sl.notes,
  sl.created_at
FROM public.stock_ledger sl
JOIN public.products p ON p.id = sl.product_id
JOIN public.invoice_items ii ON ii.product_id = p.master_product_id
WHERE ii.invoice_id = 'YOUR_INVOICE_ID'
  AND sl.transaction_type = 'out'
ORDER BY sl.created_at DESC
LIMIT 1;
```
**Expected:** New `out` transaction should exist with note containing invoice number

---

## Success Criteria

All of the following must be true:
- ✅ Invoice status changed from `finalized` → `posted`
- ✅ Serial status changed from `available`/`reserved` → `used` in `product_serials`
- ✅ Serial status changed from `reserved` → `used` in `invoice_item_serials`
- ✅ Stock ledger has new `out` transaction with correct quantity
- ✅ All operations are atomic (either all succeed or all fail)

---

## Troubleshooting

### Issue: Serial status not changed to `used`
- **Check:** Verify invoice was actually posted (status = `posted`)
- **Check:** Verify serial was linked to invoice item via `invoice_item_serials`
- **Check:** Verify serial was in `reserved` status before posting

### Issue: Stock ledger entry missing
- **Check:** Verify invoice was posted successfully
- **Check:** Verify product exists and is active
- **Check:** Verify `master_product_id` → `org product_id` mapping is correct

### Issue: Partial updates (some serials updated, others not)
- **This should never happen** - the RPC uses transactions
- If this occurs, it indicates a critical bug - check database logs

---

## SQL Logic Verification

The deployed `post_sales_invoice` function performs these operations atomically:

1. **Locks invoice row** (`SELECT FOR UPDATE`)
2. **Validates workflow** (only `finalized` → `posted`)
3. **For serial-tracked products:**
   - Counts `reserved` serials in `invoice_item_serials`
   - Updates `product_serials.status = 'used'` for linked serials
   - Updates `invoice_item_serials.status = 'used'`
   - Verifies all serials were marked as used
4. **Creates stock ledger entry** (`transaction_type = 'out'`)
5. **Updates invoice status** to `posted`

All operations are wrapped in a transaction with `RAISE;` on error, ensuring atomicity.



