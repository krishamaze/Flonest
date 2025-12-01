-- Migration: Migrate existing master products
-- Sets approval_status for existing products based on HSN code validity

BEGIN;

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
-- Only check if hsn_master table exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hsn_master') THEN
    UPDATE master_products
    SET approval_status = 'pending'
    WHERE approval_status = 'approved'
      AND hsn_code IS NOT NULL
      AND hsn_code NOT IN (SELECT hsn_code FROM hsn_master WHERE is_active = true);
  END IF;
END $$;

-- Step 4: Set approval_status for inactive/discontinued products (historical data)
UPDATE master_products
SET approval_status = 'approved'
WHERE approval_status IS NULL
  AND status IN ('inactive', 'discontinued');

-- Step 5: Set audit fields (unknown origin for migrated products)
UPDATE master_products
SET created_by = NULL,
    submitted_org_id = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    rejection_reason = NULL
WHERE created_by IS NULL;  -- Only for migrated products

-- Step 6: Log migration to review table (only if table exists)
DO $$
DECLARE
  v_migration_timestamp timestamptz;
BEGIN
  -- Get timestamp just before migration started (to identify migrated products)
  v_migration_timestamp := NOW() - INTERVAL '1 minute';

  -- Only log if master_product_reviews table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'master_product_reviews') THEN
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
    WHERE created_at < v_migration_timestamp;  -- Only log existing products, not new ones
  END IF;
END $$;

COMMIT;

