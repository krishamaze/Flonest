# Master Product Governance Plan - Final Micro-Adjustments

## Overview
This document captures the 4 critical micro-adjustments verified during reality check to ensure 100% accuracy before BUILD phase.

---

## 1. RLS Conflict Fix ✅

### Issue
Two conflicting RLS policies exist on `master_products`:
- `"master_products_read"` (no status filter)
- `"Master products: All authenticated users can read active"` (filters by status)

### Solution
**Migration:** `YYYYMMDDHHMMSS_update_master_products_rls.sql`

```sql
-- CRITICAL: Explicitly drop BOTH existing conflicting policies
DROP POLICY IF EXISTS "master_products_read" ON master_products;
DROP POLICY IF EXISTS "Master products: All authenticated users can read active" ON master_products;

-- Then create new policies (see full plan)
```

### Action Required
- Verify both policies are dropped before creating new ones
- No other policies should exist (optional safety check can be added)

---

## 2. Auto-Link RPC Behavior ✅

### Issue
`auto_link_product_to_master` must return `master_product_id` immediately, even when `approval_status='pending'`, to avoid breaking `invoices.ts`.

### Current Behavior
```sql
-- Line 100 in existing RPC
RETURNING id INTO v_master_product_id;
RETURN v_master_product_id;
```

### Solution
**Migration:** `YYYYMMDDHHMMSS_update_auto_link_product_to_master.sql`

- **CONFIRMED:** Existing RPC already uses `RETURNING id INTO v_master_product_id` ✅
- **CHANGE:** Update INSERT to include governance fields but maintain return pattern
- **NEW PARAMETER:** Add `p_user_id uuid` parameter for `created_by` audit

### Updated RPC Signature
```sql
CREATE OR REPLACE FUNCTION auto_link_product_to_master(
  p_product_id uuid,
  p_org_id uuid,
  p_user_id uuid  -- NEW: Required for audit
)
RETURNS uuid  -- Still returns immediately
```

### Key Points
- Return value behavior unchanged (still returns UUID immediately)
- Invoice creation continues without breaking
- Master product created with `approval_status='pending'` (hidden until approved)
- Draft invoices allowed, finalization blocked until approval

---

## 3. Invoice Validation Logic ✅

### Issue
Must block only **finalization**, not **draft save**, when `approval_status!='approved'`.

### Solution
**Migration:** `YYYYMMDDHHMMSS_update_validate_invoice_items.sql`

### Updated RPC Signature
```sql
CREATE OR REPLACE FUNCTION validate_invoice_items(
  p_org_id uuid,
  p_items jsonb,
  p_allow_draft boolean DEFAULT false  -- NEW: Controls validation strictness
)
RETURNS jsonb
```

### Validation Logic
```sql
-- After product existence check (line 71), before serial/stock validation:

-- NEW: Master product approval check (ONLY if not draft)
IF NOT p_allow_draft THEN
  -- Check if product has master_product_id
  -- Check if master product has approval_status='approved'
  -- Check if master product has valid hsn_code in hsn_master
  -- Add errors: 'master_product_not_approved', 'master_product_missing_hsn'
  -- Block finalization with clear error message
ELSE
  -- Draft mode: Skip master approval checks (allow pending masters)
  -- No errors for pending master products
END IF;
```

### API Call Pattern
```typescript
// Draft save: p_allow_draft=true (skip approval checks)
const validation = await supabase.rpc('validate_invoice_items', {
  p_org_id: orgId,
  p_items: items,
  p_allow_draft: true  // Allow pending masters
})

// Finalization: p_allow_draft=false (enforce approval)
const validation = await supabase.rpc('validate_invoice_items', {
  p_org_id: orgId,
  p_items: items,
  p_allow_draft: false  // Block if not approved
})
```

### Behavior
- **Draft invoices:** Can be saved with pending master products (no validation errors)
- **Finalization:** Blocked if master product not approved or missing HSN (validation errors)
- **Error messages:** Clear, actionable (e.g., "Product pending master approval. Save as draft or wait for approval.")

---

## 4. Backfill Migration ✅

### Issue
Existing master products need safe migration:
- Mark all existing active masters as `approved` (grandfather clause)
- **EXCEPTION:** If `hsn_code IS NULL`, set them to `pending` (requires HSN)

### Solution
**Migration:** `YYYYMMDDHHMMSS_migrate_existing_master_products.sql`

### Updated SQL Script
```sql
-- Step 1: Set approval_status='approved' for existing active products (grandfather clause)
UPDATE master_products
SET approval_status = 'approved'
WHERE approval_status IS NULL
  AND status = 'active';

-- Step 2: Set approval_status='pending' for products with NULL HSN code (requires HSN)
UPDATE master_products
SET approval_status = 'pending'
WHERE approval_status = 'approved'
  AND hsn_code IS NULL;

-- Step 3: Validate HSN codes and mark invalid ones as pending
UPDATE master_products
SET approval_status = 'pending'
WHERE approval_status = 'approved'
  AND hsn_code IS NOT NULL
  AND hsn_code NOT IN (SELECT hsn_code FROM hsn_master WHERE is_active = true);

-- Step 4: Set approval_status for inactive/discontinued products (historical data)
UPDATE master_products
SET approval_status = 'approved'
WHERE approval_status IS NULL
  AND status IN ('inactive', 'discontinued');

-- Step 5: Set audit fields (unknown origin)
UPDATE master_products
SET created_by = NULL,
    submitted_org_id = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL
WHERE created_by IS NULL;  -- Only for migrated products

-- Step 6: Log migration to review table
INSERT INTO master_product_reviews (master_product_id, action, reviewed_by, reviewed_at, note, previous_approval_status, new_approval_status)
SELECT 
  id,
  'migrated',
  NULL,
  NOW(),
  'Migrated from legacy system',
  NULL,
  approval_status
FROM master_products
WHERE created_at < NOW() - INTERVAL '1 minute';  -- Only log existing products, not new ones
```

### Migration Result
- **Active products with valid HSN:** `approval_status='approved'` (visible to all)
- **Active products with NULL HSN:** `approval_status='pending'` (requires review)
- **Active products with invalid HSN:** `approval_status='pending'` (requires review)
- **Inactive/discontinued products:** `approval_status='approved'` (historical data)

### Seed Data Update
**Migration:** `YYYYMMDDHHMMSS_update_seed_demo_master_products.sql`

```sql
-- Update seed data to include approval_status
-- Products with hsn_code: approval_status='approved'
-- Products with hsn_code=NULL: approval_status='pending'
INSERT INTO master_products (..., approval_status, created_by, submitted_org_id)
VALUES
  (..., 'approved', NULL, NULL),  -- Products with valid HSN
  (..., 'pending', NULL, NULL)    -- Products with NULL HSN (e.g., services)
```

---

## Implementation Checklist

### Before BUILD
- [ ] Verify both RLS policies are explicitly dropped
- [ ] Confirm `auto_link_product_to_master` maintains `RETURNING id` pattern
- [ ] Add `p_allow_draft` parameter to `validate_invoice_items` RPC
- [ ] Update backfill migration to set NULL HSN products to `pending`
- [ ] Update seed data migration to include `approval_status`

### During BUILD
- [ ] Test RLS policy drops (no conflicts)
- [ ] Test auto-link return value (invoice creation continues)
- [ ] Test draft invoice creation (pending masters allowed)
- [ ] Test invoice finalization (pending masters blocked)
- [ ] Test backfill migration (NULL HSN → pending)
- [ ] Verify seed data includes `approval_status`

### After BUILD
- [ ] Verify all existing active masters have `approval_status` set
- [ ] Verify NULL HSN products are `pending` (not `approved`)
- [ ] Verify draft invoices can be saved with pending masters
- [ ] Verify finalization blocked for pending masters
- [ ] Verify RLS policies work correctly (no conflicts)

---

## Key Decisions Finalized

| Question | Decision |
|----------|----------|
| **RLS conflict resolution** | Drop both policies explicitly, create new ones |
| **Auto-link return value** | Maintain `RETURNING id` pattern (no breaking change) |
| **Invoice validation** | Block only finalization, allow draft saves |
| **Backfill NULL HSN** | Set to `pending` (not `approved`) |
| **Seed data status** | Products with HSN: `approved`, NULL HSN: `pending` |

---

## Notes

1. **Backward Compatibility:** Auto-link RPC maintains return value behavior (UUID), so `invoices.ts` continues to work without changes to return value handling.

2. **Draft vs Finalization:** Frontend must pass `p_allow_draft=true` for draft saves and `p_allow_draft=false` for finalization.

3. **NULL HSN Handling:** Products with NULL HSN are set to `pending` during migration, requiring internal review to add HSN before approval.

4. **Seed Data:** Demo products with NULL HSN (e.g., services) are set to `pending` to demonstrate the approval workflow.

---

## Ready for BUILD ✅

All 4 micro-adjustments are verified and documented. The plan is 100% aligned with current schema and flow. Proceed with BUILD phase.

