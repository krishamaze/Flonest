-- Migration: Add foreign key constraint from master_products.hsn_code to hsn_master.hsn_code
-- Ensures HSN codes reference valid entries in hsn_master
-- Nullable for pending products that don't have HSN yet

BEGIN;

-- Step 1: Set hsn_code to NULL for products with invalid HSN codes (before adding FK)
-- This ensures the FK constraint can be added without errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hsn_master') THEN
    -- Set hsn_code to NULL for products where HSN doesn't exist in hsn_master
    UPDATE master_products
    SET hsn_code = NULL
    WHERE hsn_code IS NOT NULL
      AND hsn_code NOT IN (SELECT hsn_code FROM hsn_master WHERE is_active = true);
  END IF;
END $$;

-- Step 2: Add foreign key constraint (nullable, so pending products can have NULL hsn_code)
ALTER TABLE master_products
DROP CONSTRAINT IF EXISTS fk_master_products_hsn_code;

-- Only add FK if hsn_master table exists and has at least one row
-- If hsn_master is empty, we'll skip the FK for now (it can be added later when HSN data is populated)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'hsn_master'
  ) AND EXISTS (
    SELECT 1 FROM hsn_master LIMIT 1
  ) THEN
    ALTER TABLE master_products
    ADD CONSTRAINT fk_master_products_hsn_code 
    FOREIGN KEY (hsn_code) REFERENCES hsn_master(hsn_code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  ELSE
    -- hsn_master is empty, create a comment to add FK later
    COMMENT ON COLUMN master_products.hsn_code IS 'Will have FK to hsn_master once HSN data is populated';
  END IF;
END $$;

COMMIT;

