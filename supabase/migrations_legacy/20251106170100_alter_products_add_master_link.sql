-- M4: Add master_product_id link to products table
-- Enables org products to link to master products catalog

BEGIN;

-- Add master_product_id column (nullable, allows org-only products)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS master_product_id uuid REFERENCES master_products(id) ON DELETE RESTRICT;

-- Add created_by column if it doesn't exist (for audit trail)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- Add alias_name column for org-specific product name override
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS alias_name text;

-- Update unique constraint: allow one org product per master product
-- Only enforce uniqueness when master_product_id is NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_master_unique 
ON products(org_id, master_product_id) 
WHERE master_product_id IS NOT NULL;

-- Update existing SKU unique index to handle NULL sku (when using master SKU)
-- The existing partial index already handles this, but ensure it's correct
DROP INDEX IF EXISTS idx_products_org_sku;
CREATE UNIQUE INDEX idx_products_org_sku 
ON products(org_id, sku) 
WHERE status = 'active' AND sku IS NOT NULL;

-- Add index for master product lookups
CREATE INDEX IF NOT EXISTS idx_products_master_product ON products(master_product_id) 
WHERE master_product_id IS NOT NULL;

-- Add index for alias_name search (using trigram for fuzzy search)
CREATE INDEX IF NOT EXISTS idx_products_alias_name_trgm ON products USING gin(alias_name gin_trgm_ops) 
WHERE alias_name IS NOT NULL;

-- Note: RLS policy already exists from previous migration and will continue to work
-- The existing policy "products_tenant_isolation" scopes by org_id

COMMIT;


