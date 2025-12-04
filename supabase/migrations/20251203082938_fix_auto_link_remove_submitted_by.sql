-- Fix: Remove submitted_by column reference (column doesn't exist)

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
    v_hsn_code := v_product.hsn_sac_code;
    v_gst_rate := v_product.tax_rate;

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
      'auto_pass',
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