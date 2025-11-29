-- Add foreign key constraint for products.master_product_id
-- This enables Supabase to infer the relationship for joins

-- Check if the constraint already exists before adding it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'products'
      AND constraint_name = 'products_master_product_id_fkey'
  ) THEN
    ALTER TABLE public.products
    ADD CONSTRAINT products_master_product_id_fkey
    FOREIGN KEY (master_product_id)
    REFERENCES public.master_products(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_master_product_id
  ON public.products(master_product_id)
  WHERE master_product_id IS NOT NULL;
