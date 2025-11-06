-- M4: Create/Update master_products table
-- Global product master catalog with unique SKU/EAN identifiers
-- Read-only for users, writes via RPC/admin only

BEGIN;

-- Enable pg_trgm extension for fuzzy text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create master_products table if it doesn't exist, or alter existing one
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'master_products') THEN
    -- Create new table with full schema
    CREATE TABLE master_products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sku text NOT NULL,
      barcode_ean text,
      name text NOT NULL,
      category text,
      hsn_code text,
      base_unit text NOT NULL DEFAULT 'pcs',
      base_price numeric(12,2),
      gst_rate numeric(5,2) CHECK (gst_rate >= 0 AND gst_rate <= 28),
      gst_type text CHECK (gst_type IN ('goods', 'services')) DEFAULT 'goods',
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT check_sku_or_ean CHECK (sku IS NOT NULL OR barcode_ean IS NOT NULL)
    );
  ELSE
    -- Table exists, add missing columns
    ALTER TABLE master_products 
      ADD COLUMN IF NOT EXISTS barcode_ean text,
      ADD COLUMN IF NOT EXISTS category text,
      ADD COLUMN IF NOT EXISTS hsn_code text,
      ADD COLUMN IF NOT EXISTS base_unit text DEFAULT 'pcs',
      ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2),
      ADD COLUMN IF NOT EXISTS gst_type text DEFAULT 'goods',
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    
    -- Update base_price column type if needed (from DECIMAL to numeric)
    -- This is safe if it's already numeric
    DO $base_price_check$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'master_products' 
        AND column_name = 'base_price' 
        AND data_type = 'numeric'
      ) THEN
        -- Column exists and is numeric, no change needed
        NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'master_products' 
        AND column_name = 'base_price'
      ) THEN
        -- Column exists but different type, alter it
        ALTER TABLE master_products ALTER COLUMN base_price TYPE numeric(12,2);
      ELSE
        -- Column doesn't exist, add it
        ALTER TABLE master_products ADD COLUMN base_price numeric(12,2);
      END IF;
    END $base_price_check$;
    
    -- Update status constraint if needed
    ALTER TABLE master_products DROP CONSTRAINT IF EXISTS master_products_status_check;
    ALTER TABLE master_products ADD CONSTRAINT master_products_status_check 
      CHECK (status IN ('active', 'inactive', 'discontinued', 'pending'));
    
    -- Add check constraint for sku_or_ean if not exists
    ALTER TABLE master_products DROP CONSTRAINT IF EXISTS check_sku_or_ean;
    ALTER TABLE master_products ADD CONSTRAINT check_sku_or_ean 
      CHECK (sku IS NOT NULL OR barcode_ean IS NOT NULL);
    
    -- Add gst_rate check constraint
    ALTER TABLE master_products DROP CONSTRAINT IF EXISTS master_products_gst_rate_check;
    ALTER TABLE master_products ADD CONSTRAINT master_products_gst_rate_check 
      CHECK (gst_rate IS NULL OR (gst_rate >= 0 AND gst_rate <= 28));
    
    -- Add gst_type check constraint
    ALTER TABLE master_products DROP CONSTRAINT IF EXISTS master_products_gst_type_check;
    ALTER TABLE master_products ADD CONSTRAINT master_products_gst_type_check 
      CHECK (gst_type IS NULL OR gst_type IN ('goods', 'services'));
  END IF;
END $$;

-- Unique indexes (partial, only for non-null values)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_master_products_sku') THEN
    CREATE UNIQUE INDEX idx_master_products_sku ON master_products(sku) WHERE sku IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_master_products_ean') THEN
    CREATE UNIQUE INDEX idx_master_products_ean ON master_products(barcode_ean) WHERE barcode_ean IS NOT NULL;
  END IF;
END $$;

-- Performance indexes for search
CREATE INDEX IF NOT EXISTS idx_master_products_name_trgm ON master_products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_master_products_category ON master_products(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_status ON master_products(status) WHERE status = 'active';

-- RLS: Read-only for all authenticated users
ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read master products
DROP POLICY IF EXISTS "master_products_read" ON master_products;
CREATE POLICY "master_products_read" ON master_products FOR SELECT
  USING (auth.role() = 'authenticated');

-- Note: INSERT/UPDATE/DELETE operations must use RPC functions or admin access
-- Direct writes are blocked by RLS (no policy for INSERT/UPDATE/DELETE)

COMMIT;

