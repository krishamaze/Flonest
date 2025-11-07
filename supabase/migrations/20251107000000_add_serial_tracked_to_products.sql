-- Add serial_tracked flag to products table
-- Enables serial number tracking for specific products

BEGIN;

-- Add serial_tracked column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS serial_tracked boolean NOT NULL DEFAULT false;

-- Add index for fast filtering of serial-tracked products
CREATE INDEX IF NOT EXISTS idx_products_serial_tracked ON products(org_id, serial_tracked) WHERE serial_tracked = true;

COMMIT;

