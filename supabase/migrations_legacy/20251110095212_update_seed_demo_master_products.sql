-- Migration: Update seed demo master products
-- Adds approval_status to seed data based on HSN code presence

BEGIN;

-- Update existing seed data to include approval_status
-- Products with hsn_code: approval_status='approved'
-- Products with hsn_code=NULL: approval_status='pending'

UPDATE master_products
SET approval_status = CASE
  WHEN hsn_code IS NOT NULL THEN 'approved'
  ELSE 'pending'
END,
created_by = NULL,
submitted_org_id = NULL
WHERE sku LIKE 'DEMO-%'
  AND (approval_status IS NULL OR approval_status = 'pending');

-- Note: The original seed migration (20251106170400_seed_demo_master_products.sql) will continue to work
-- but new inserts should include approval_status. This migration ensures existing seed data is updated.

COMMIT;

