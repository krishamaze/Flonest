-- M4: RPC function to create org product from master product
-- Allows orgs to adopt master products with local overrides

BEGIN;

-- Function to create org product from master product
CREATE OR REPLACE FUNCTION create_product_from_master(
  p_org_id uuid,
  p_master_product_id uuid,
  p_alias_name text DEFAULT NULL,
  p_unit text DEFAULT NULL,
  p_selling_price numeric DEFAULT NULL,
  p_cost_price numeric DEFAULT NULL,
  p_min_stock_level integer DEFAULT 0,
  p_sku text DEFAULT NULL,
  p_barcode_ean text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id uuid;
  v_master_product master_products%ROWTYPE;
BEGIN
  -- Verify org_id matches current user's org
  IF p_org_id != current_user_org_id() THEN
    RAISE EXCEPTION 'Cannot create product for different organization';
  END IF;

  -- Fetch master product details
  SELECT * INTO v_master_product
  FROM master_products
  WHERE id = p_master_product_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master product not found or inactive';
  END IF;

  -- Check if org already has a product linked to this master
  SELECT id INTO v_product_id
  FROM products
  WHERE org_id = p_org_id AND master_product_id = p_master_product_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Product already linked to this master product for this organization';
  END IF;

  -- Create org product with master defaults and overrides
  INSERT INTO products (
    org_id,
    master_product_id,
    name,
    alias_name,
    sku,
    ean,
    category,
    unit,
    selling_price,
    cost_price,
    min_stock_level,
    status,
    created_by
  ) VALUES (
    p_org_id,
    p_master_product_id,
    COALESCE(p_alias_name, v_master_product.name), -- Use alias if provided, else master name
    p_alias_name,
    COALESCE(p_sku, v_master_product.sku), -- Use org SKU if provided, else master SKU
    COALESCE(p_barcode_ean, v_master_product.barcode_ean),
    COALESCE(p_category, v_master_product.category),
    COALESCE(p_unit, v_master_product.base_unit),
    COALESCE(p_selling_price, v_master_product.base_price),
    p_cost_price,
    p_min_stock_level,
    'active',
    p_created_by
  )
  RETURNING id INTO v_product_id;

  RETURN v_product_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_product_from_master TO authenticated;

COMMIT;


