-- M4: Seed demo master products for testing
-- Optional: Remove or modify for production

BEGIN;

-- Check if min_selling_price column exists (old schema)
DO $$
DECLARE
  has_min_selling_price boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_products' 
    AND column_name = 'min_selling_price'
  ) INTO has_min_selling_price;
  
  IF has_min_selling_price THEN
    -- Old schema: include min_selling_price
    INSERT INTO master_products (sku, barcode_ean, name, category, hsn_code, base_unit, base_price, min_selling_price, gst_rate, gst_type, status)
    VALUES
      ('DEMO-001', '1234567890123', 'Sample Product A', 'Electronics', '85171200', 'pcs', 1000.00, 1000.00, 18.00, 'goods', 'active'),
      ('DEMO-002', '1234567890124', 'Sample Product B', 'Clothing', '61091000', 'pcs', 500.00, 500.00, 12.00, 'goods', 'active'),
      ('DEMO-003', NULL, 'Sample Service Product', 'Services', NULL, 'hours', 200.00, 200.00, 18.00, 'services', 'active'),
      ('DEMO-004', '1234567890125', 'Sample Product C', 'Food & Beverages', '21069099', 'kg', 150.00, 150.00, 5.00, 'goods', 'active')
    ON CONFLICT (sku) DO NOTHING;
  ELSE
    -- New schema: no min_selling_price
    INSERT INTO master_products (sku, barcode_ean, name, category, hsn_code, base_unit, base_price, gst_rate, gst_type, status)
    VALUES
      ('DEMO-001', '1234567890123', 'Sample Product A', 'Electronics', '85171200', 'pcs', 1000.00, 18.00, 'goods', 'active'),
      ('DEMO-002', '1234567890124', 'Sample Product B', 'Clothing', '61091000', 'pcs', 500.00, 12.00, 'goods', 'active'),
      ('DEMO-003', NULL, 'Sample Service Product', 'Services', NULL, 'hours', 200.00, 18.00, 'services', 'active'),
      ('DEMO-004', '1234567890125', 'Sample Product C', 'Food & Beverages', '21069099', 'kg', 150.00, 5.00, 'goods', 'active')
    ON CONFLICT (sku) DO NOTHING;
  END IF;
END $$;

COMMIT;

