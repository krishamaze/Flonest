-- Security Fix: Tenant Isolation in RPC Functions
-- CRITICAL: lookup_serial_number and lookup_product_code accept p_org_id without validation
-- This allows any authenticated user to query any org's data (tenant isolation breach)
--
-- Fix: Validate p_org_id against current_user_org_id() at function entry
-- Pattern: Either use current_user_org_id() directly OR validate p_org_id = current_user_org_id()

BEGIN;

-- =====================================================
-- Fix lookup_serial_number: Add org_id validation
-- =====================================================

CREATE OR REPLACE FUNCTION public.lookup_serial_number(
  p_org_id uuid,
  p_serial_number text
)
RETURNS TABLE (
  found boolean,
  lookup_type text,
  product_id uuid,
  product_name text,
  product_sku text,
  selling_price numeric,
  hsn_code text,
  gst_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
  v_product_record record;
  v_category_record record;
BEGIN
  -- CRITICAL: Validate tenant isolation - ensure user can only access their own org's data
  v_user_org_id := public.current_user_org_id();
  
  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;
  
  IF p_org_id IS NULL OR p_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Access denied: org_id parameter must match current user organization';
  END IF;

  -- Level 1: Check product_serials (Serial Number lookup)
  SELECT 
    ps.product_id,
    p.name,
    p.sku,
    p.selling_price,
    p.category_id
  INTO v_product_record
  FROM public.product_serials ps
  JOIN public.products p ON p.id = ps.product_id
  WHERE ps.org_id = p_org_id
    AND ps.serial_number = trim(p_serial_number)
    AND ps.status IN ('available','reserved')
  LIMIT 1;
  
  IF v_product_record.product_id IS NOT NULL THEN
    -- Found via serial number - get HSN/tax from category
    IF v_product_record.category_id IS NOT NULL THEN
      SELECT 
        mc.hsn_code,
        mc.gst_rate
      INTO v_category_record
      FROM public.master_categories mc
      WHERE mc.id = v_product_record.category_id
        AND mc.is_active = true;
    END IF;
    
    RETURN QUERY
    SELECT 
      true as found,
      'serial_number'::text as lookup_type,
      v_product_record.product_id,
      v_product_record.name as product_name,
      v_product_record.sku as product_sku,
      v_product_record.selling_price,
      COALESCE(v_category_record.hsn_code, NULL) as hsn_code,
      COALESCE(v_category_record.gst_rate, NULL) as gst_rate;
    RETURN;
  END IF;
  
  -- Not found
  RETURN QUERY
  SELECT false, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, NULL::numeric;
END;
$$;

-- =====================================================
-- Fix lookup_product_code: Add org_id validation
-- =====================================================

CREATE OR REPLACE FUNCTION public.lookup_product_code(
  p_org_id uuid,
  p_code text
)
RETURNS TABLE (
  found boolean,
  lookup_type text,
  product_id uuid,
  master_product_id uuid,
  product_name text,
  product_sku text,
  selling_price numeric,
  hsn_code text,
  gst_rate numeric,
  category_id uuid,
  category_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
  v_product_record record;
  v_master_record record;
  v_category_record record;
BEGIN
  -- CRITICAL: Validate tenant isolation - ensure user can only access their own org's data
  v_user_org_id := public.current_user_org_id();
  
  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;
  
  IF p_org_id IS NULL OR p_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Access denied: org_id parameter must match current user organization';
  END IF;

  -- Level 2: Check products table (SKU lookup)
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.selling_price,
    p.category_id,
    p.master_product_id
  INTO v_product_record
  FROM public.products p
  WHERE p.org_id = p_org_id
    AND p.status = 'active'
    AND (p.sku = trim(p_code) OR p.ean = trim(p_code))
  LIMIT 1;
  
  IF v_product_record.id IS NOT NULL THEN
    -- Found via SKU - get HSN/tax from category or master_product
    IF v_product_record.category_id IS NOT NULL THEN
      SELECT 
        mc.id,
        mc.name,
        mc.hsn_code,
        mc.gst_rate
      INTO v_category_record
      FROM public.master_categories mc
      WHERE mc.id = v_product_record.category_id
        AND mc.is_active = true;
    ELSIF v_product_record.master_product_id IS NOT NULL THEN
      SELECT 
        mp.hsn_code,
        mp.gst_rate
      INTO v_master_record
      FROM public.master_products mp
      WHERE mp.id = v_product_record.master_product_id
        AND mp.approval_status = 'approved'
        AND mp.status = 'active';
    END IF;
    
    RETURN QUERY
    SELECT 
      true as found,
      'product_code'::text as lookup_type,
      v_product_record.id,
      v_product_record.master_product_id,
      v_product_record.name,
      v_product_record.sku,
      v_product_record.selling_price,
      COALESCE(v_category_record.hsn_code, v_master_record.hsn_code, NULL) as hsn_code,
      COALESCE(v_category_record.gst_rate, v_master_record.gst_rate, NULL) as gst_rate,
      v_product_record.category_id,
      COALESCE(v_category_record.name, NULL) as category_name;
    RETURN;
  END IF;
  
  -- Not found - Level 3 would be handled by application (show create form)
  RETURN QUERY
  SELECT 
    false, 
    NULL::text, 
    NULL::uuid, 
    NULL::uuid, 
    NULL::text, 
    NULL::text, 
    NULL::numeric, 
    NULL::text, 
    NULL::numeric,
    NULL::uuid,
    NULL::text;
END;
$$;

-- =====================================================
-- Add alternative function that uses current_user_org_id directly
-- (Safer: client cannot pass org_id at all)
-- =====================================================

CREATE OR REPLACE FUNCTION public.lookup_serial_number_current_org(
  p_serial_number text
)
RETURNS TABLE (
  found boolean,
  lookup_type text,
  product_id uuid,
  product_name text,
  product_sku text,
  selling_price numeric,
  hsn_code text,
  gst_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get org_id from authenticated user (no client input)
  v_org_id := public.current_user_org_id();
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;

  -- Delegate to main function with validated org_id
  RETURN QUERY
  SELECT * FROM public.lookup_serial_number(v_org_id, p_serial_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_product_code_current_org(
  p_code text
)
RETURNS TABLE (
  found boolean,
  lookup_type text,
  product_id uuid,
  master_product_id uuid,
  product_name text,
  product_sku text,
  selling_price numeric,
  hsn_code text,
  gst_rate numeric,
  category_id uuid,
  category_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get org_id from authenticated user (no client input)
  v_org_id := public.current_user_org_id();
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any organization';
  END IF;

  -- Delegate to main function with validated org_id
  RETURN QUERY
  SELECT * FROM public.lookup_product_code(v_org_id, p_code);
END;
$$;

-- =====================================================
-- Grant execute permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.lookup_serial_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_product_code(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_serial_number_current_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_product_code_current_org(text) TO authenticated;

COMMIT;

