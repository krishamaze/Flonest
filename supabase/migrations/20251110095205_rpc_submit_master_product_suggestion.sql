-- Migration: Create submit_master_product_suggestion RPC
-- Allows org users to submit master product suggestions for review

BEGIN;

CREATE OR REPLACE FUNCTION submit_master_product_suggestion(
  p_name text,
  p_sku text,
  p_barcode_ean text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_suggested_hsn_code text DEFAULT NULL,
  p_base_unit text DEFAULT 'pcs',
  p_base_price numeric DEFAULT NULL,
  p_org_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_product_id uuid;
  v_sku_counter integer := 0;
  v_final_sku text;
  v_org_prefix text;
BEGIN
  -- Verify org_id matches user's org
  IF NOT EXISTS (
    SELECT 1 FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = p_user_id AND m.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to the specified organization';
  END IF;

  -- Generate unique SKU if needed (handle conflicts)
  v_final_sku := p_sku;
  
  -- If SKU already exists, append counter
  WHILE EXISTS (SELECT 1 FROM master_products WHERE sku = v_final_sku) LOOP
    v_sku_counter := v_sku_counter + 1;
    v_final_sku := p_sku || '-' || v_sku_counter::text;
    IF v_sku_counter > 1000 THEN
      RAISE EXCEPTION 'Could not generate unique SKU for master product after 1000 attempts';
    END IF;
  END LOOP;

  -- Validate HSN code if provided (check if it exists in hsn_master)
  IF p_suggested_hsn_code IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM hsn_master WHERE hsn_code = p_suggested_hsn_code AND is_active = true) THEN
      -- Warn but don't block (HSN will be validated on approval)
      -- We allow NULL hsn_code for pending products
    END IF;
  END IF;

  -- Create master product with approval_status='pending'
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
    status,
    approval_status,
    created_by,
    submitted_org_id
  )
  VALUES (
    v_final_sku,
    p_barcode_ean,
    p_name,
    p_category,
    p_suggested_hsn_code, -- Can be NULL, will be set on approval
    p_base_unit,
    p_base_price,
    NULL, -- GST rate will be derived from hsn_master on approval
    'goods', -- Default to goods
    'active', -- Status is active but hidden via RLS until approved
    'pending', -- Approval status
    p_user_id,
    p_org_id
  )
  RETURNING id INTO v_master_product_id;

  -- Log submission to review table
  INSERT INTO master_product_reviews (
    master_product_id,
    action,
    reviewed_by,
    reviewed_at,
    note,
    previous_approval_status,
    new_approval_status
  )
  VALUES (
    v_master_product_id,
    'submitted',
    NULL, -- Not reviewed yet
    NOW(),
    'Master product submitted by org user',
    NULL,
    'pending'
  );

  RETURN v_master_product_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION submit_master_product_suggestion TO authenticated;

COMMIT;

