-- Migration: Add Master Product Linking RPC Functions
--
-- Creates two functions:
-- 1. auto_link_product_to_master - Auto-creates master product from org product and links
-- 2. create_product_from_master - Creates org product from existing master product

-- =====================================================
-- 1. auto_link_product_to_master
-- =====================================================
-- Called during invoice creation when product doesn't have master_product_id
-- Finds existing master by SKU or creates new one, then links

CREATE OR REPLACE FUNCTION public.auto_link_product_to_master(
  p_product_id uuid,
  p_org_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
  v_master_product_id uuid;
  v_hsn_code text;
  v_gst_rate numeric(5,2);
BEGIN
  -- Get the org product
  SELECT id, name, sku, hsn_sac_code, tax_rate, selling_price, unit, master_product_id
  INTO v_product
  FROM products
  WHERE id = p_product_id
    AND org_id = p_org_id
    AND status = 'active';

  IF v_product IS NULL THEN
    RAISE EXCEPTION 'Product not found or does not belong to organization';
  END IF;

  -- If already linked, return existing master_product_id
  IF v_product.master_product_id IS NOT NULL THEN
    RETURN v_product.master_product_id;
  END IF;

  -- Try to find existing master product by SKU
  SELECT id INTO v_master_product_id
  FROM master_products
  WHERE sku = v_product.sku
    AND status = 'active'
  LIMIT 1;

  -- If no master found, create one
  IF v_master_product_id IS NULL THEN
    -- Get HSN/GST from product or default
    v_hsn_code := v_product.hsn_sac_code;
    v_gst_rate := v_product.tax_rate;

    -- If no HSN, try to get from hsn_master (default 18%)
    IF v_hsn_code IS NULL THEN
      SELECT hsn_code, gst_rate INTO v_hsn_code, v_gst_rate
      FROM hsn_master
      WHERE gst_rate = 18 AND is_active = true
      LIMIT 1;
    END IF;

    INSERT INTO master_products (
      name,
      sku,
      hsn_code,
      gst_rate,
      base_price,
      base_unit,
      approval_status,
      submitted_org_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_product.name,
      v_product.sku,
      v_hsn_code,
      COALESCE(v_gst_rate, 18),
      v_product.selling_price,
      COALESCE(v_product.unit, 'pcs'),
      'auto_pass',  -- Auto-created products get auto_pass status
      p_org_id,
      'active',
      now(),
      now()
    )
    RETURNING id INTO v_master_product_id;
  END IF;

  -- Link the org product to master
  UPDATE products
  SET master_product_id = v_master_product_id,
      updated_at = now()
  WHERE id = p_product_id
    AND org_id = p_org_id;

  RETURN v_master_product_id;
END;
$$;

COMMENT ON FUNCTION public.auto_link_product_to_master IS
  'Auto-links an org product to a master product. Creates master if none exists with matching SKU.';

GRANT EXECUTE ON FUNCTION public.auto_link_product_to_master TO authenticated;


-- =====================================================
-- 2. create_product_from_master
-- =====================================================
-- Creates an org product linked to an existing master product

CREATE OR REPLACE FUNCTION public.create_product_from_master(
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
SET search_path = public
AS $$
DECLARE
  v_master record;
  v_product_id uuid;
  v_final_sku text;
BEGIN
  -- Get master product
  SELECT id, name, sku, hsn_code, gst_rate, base_price, base_unit
  INTO v_master
  FROM master_products
  WHERE id = p_master_product_id
    AND status = 'active';

  IF v_master IS NULL THEN
    RAISE EXCEPTION 'Master product not found or inactive';
  END IF;

  -- Determine SKU (use provided or master's)
  v_final_sku := COALESCE(p_sku, v_master.sku);

  -- Check if product with this master already exists for this org
  SELECT id INTO v_product_id
  FROM products
  WHERE org_id = p_org_id
    AND master_product_id = p_master_product_id
    AND status = 'active'
  LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'Product already linked to this master product for this organization'
      USING ERRCODE = '23505';
  END IF;

  -- Create the org product
  INSERT INTO products (
    org_id,
    master_product_id,
    name,
    sku,
    ean,
    category,
    unit,
    cost_price,
    selling_price,
    min_stock_level,
    tax_rate,
    hsn_sac_code,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_org_id,
    p_master_product_id,
    COALESCE(p_alias_name, v_master.name),
    v_final_sku,
    p_barcode_ean,
    p_category,
    COALESCE(p_unit, v_master.base_unit, 'pcs'),
    p_cost_price,
    COALESCE(p_selling_price, v_master.base_price),
    COALESCE(p_min_stock_level, 0),
    v_master.gst_rate,
    v_master.hsn_code,
    'active',
    now(),
    now()
  )
  RETURNING id INTO v_product_id;

  RETURN v_product_id;
END;
$$;

COMMENT ON FUNCTION public.create_product_from_master IS
  'Creates an org product linked to an existing master product with optional overrides.';

GRANT EXECUTE ON FUNCTION public.create_product_from_master TO authenticated;