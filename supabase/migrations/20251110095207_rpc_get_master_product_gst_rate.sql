-- Migration: Create get_master_product_gst_rate RPC
-- Looks up GST rate from hsn_master table based on master product's HSN code

BEGIN;

CREATE OR REPLACE FUNCTION get_master_product_gst_rate(
  p_master_product_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_hsn_code text;
  v_gst_rate numeric;
BEGIN
  -- Get HSN code from master product
  SELECT hsn_code INTO v_hsn_code
  FROM master_products
  WHERE id = p_master_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master product not found';
  END IF;

  -- If HSN code is NULL, return NULL (product doesn't have HSN)
  IF v_hsn_code IS NULL THEN
    RETURN NULL;
  END IF;

  -- Look up GST rate from hsn_master
  SELECT gst_rate INTO v_gst_rate
  FROM hsn_master
  WHERE hsn_code = v_hsn_code AND is_active = true;

  -- If HSN not found in hsn_master, fall back to master_products.gst_rate (legacy support)
  IF v_gst_rate IS NULL THEN
    SELECT gst_rate INTO v_gst_rate
    FROM master_products
    WHERE id = p_master_product_id;
  END IF;

  RETURN v_gst_rate;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_master_product_gst_rate(uuid) TO authenticated;

COMMIT;

