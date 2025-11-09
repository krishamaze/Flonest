-- RPC: Auto-create master product and link to org product
-- Automatically creates a master product from org product data and links them
-- This allows products without master_product_id to be used in invoices

BEGIN;

-- Function to auto-create master product and link to org product
CREATE OR REPLACE FUNCTION auto_link_product_to_master(
  p_product_id uuid,
  p_org_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_master_product_id uuid;
  v_sku text;
  v_org_prefix text;
  v_sku_counter integer := 0;
  v_base_sku text;
BEGIN
  -- Verify product exists and belongs to org
  SELECT * INTO v_product
  FROM products
  WHERE id = p_product_id
    AND org_id = p_org_id
    AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or does not belong to organization';
  END IF;
  
  -- Check if product already has master_product_id
  IF v_product.master_product_id IS NOT NULL THEN
    RETURN v_product.master_product_id;
  END IF;
  
  -- Generate unique SKU for master product (org-specific prefix to avoid conflicts)
  -- Use org slug or first 8 chars of org_id as prefix
  SELECT COALESCE(
    NULLIF(TRIM(slug), ''),
    LEFT(REPLACE(p_org_id::text, '-', ''), 8)
  ) INTO v_org_prefix
  FROM orgs
  WHERE id = p_org_id;
  
  -- If org not found, use product_id prefix
  IF v_org_prefix IS NULL OR v_org_prefix = '' THEN
    v_org_prefix := LEFT(REPLACE(p_product_id::text, '-', ''), 8);
  END IF;
  
  -- Generate SKU: ORG-{org_prefix}-{product_sku} or ORG-{org_prefix}-{product_id}
  -- Ensure SKU is unique by appending product_id if needed
  IF v_product.sku IS NOT NULL AND v_product.sku != '' THEN
    v_base_sku := 'ORG-' || v_org_prefix || '-' || v_product.sku;
  ELSE
    -- No SKU, generate from product_id
    v_base_sku := 'ORG-' || v_org_prefix || '-' || LEFT(REPLACE(p_product_id::text, '-', ''), 12);
  END IF;
  
  -- Ensure SKU is truly unique (handle conflicts)
  v_sku := v_base_sku;
  WHILE EXISTS (SELECT 1 FROM master_products WHERE sku = v_sku) LOOP
    v_sku_counter := v_sku_counter + 1;
    v_sku := v_base_sku || '-' || v_sku_counter::text;
    -- Safety: prevent infinite loop
    IF v_sku_counter > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique SKU for master product after 1000 attempts';
    END IF;
  END LOOP;
  
  -- Create new master product from org product data
  INSERT INTO master_products (
    sku,
    barcode_ean,
    name,
    category,
    hsn_code,
    base_unit,
    base_price,
    gst_rate,
    gst_type,
    status
  )
  VALUES (
    v_sku,
    v_product.ean,
    COALESCE(v_product.alias_name, v_product.name),
    v_product.category,
    NULL, -- HSN code not available in products table
    COALESCE(v_product.unit, 'pcs'),
    v_product.selling_price,
    NULL, -- GST rate not available in products table, will be set later
    'goods', -- Default to goods
    'active'
  )
  RETURNING id INTO v_master_product_id;
  
  -- Link org product to master product
  UPDATE products
  SET master_product_id = v_master_product_id
  WHERE id = p_product_id;
  
  RETURN v_master_product_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auto_link_product_to_master(uuid, uuid) TO authenticated;

COMMIT;

