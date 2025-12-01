-- Add EAN and unit fields to products table
-- EAN: European Article Number (barcode)
-- Unit: Measurement unit (e.g., 'pcs', 'kg', 'liters', 'boxes')

BEGIN;

-- Add EAN field (optional, for barcode scanning)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS ean text;

-- Add unit field (optional, default to 'pcs')
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'pcs';

-- Add index for EAN lookups (if barcode scanning is used)
CREATE INDEX IF NOT EXISTS idx_products_org_ean ON products(org_id, ean) WHERE ean IS NOT NULL;

COMMIT;

