-- Migration: Update search_master_products RPC
-- Filters by approval_status='approved' for org users, allows internal users to see pending

BEGIN;

CREATE OR REPLACE FUNCTION search_master_products(
  search_query text DEFAULT NULL,
  search_sku text DEFAULT NULL,
  search_ean text DEFAULT NULL,
  search_category text DEFAULT NULL,
  result_limit integer DEFAULT 50,
  result_offset integer DEFAULT 0,
  include_pending boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  sku text,
  barcode_ean text,
  name text,
  category text,
  hsn_code text,
  base_unit text,
  base_price numeric,
  gst_rate numeric,
  gst_type text,
  status text,
  approval_status text,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_internal boolean;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Check if user is internal
  v_is_internal := is_internal_user(v_user_id);

  RETURN QUERY
  SELECT 
    mp.id,
    mp.sku,
    mp.barcode_ean,
    mp.name,
    mp.category,
    mp.hsn_code,
    mp.base_unit,
    mp.base_price,
    mp.gst_rate,
    mp.gst_type,
    mp.status,
    mp.approval_status,
    mp.created_at,
    mp.updated_at
  FROM master_products mp
  WHERE 
    -- For internal users: show all if include_pending=true, otherwise only approved
    -- For org users: only show approved+active
    (
      (v_is_internal AND (include_pending OR mp.approval_status = 'approved'))
      OR
      (NOT v_is_internal AND mp.approval_status = 'approved' AND mp.status = 'active')
    )
    AND (
      -- Exact SKU match (highest priority)
      (search_sku IS NOT NULL AND mp.sku = search_sku)
      OR
      -- Exact EAN match (high priority)
      (search_ean IS NOT NULL AND mp.barcode_ean = search_ean)
      OR
      -- Category filter
      (search_category IS NOT NULL AND mp.category = search_category)
      OR
      -- Text search on name (fuzzy match using trigram similarity)
      (search_query IS NOT NULL AND (
        mp.name ILIKE '%' || search_query || '%'
        OR mp.sku ILIKE '%' || search_query || '%'
        OR (mp.barcode_ean IS NOT NULL AND mp.barcode_ean ILIKE '%' || search_query || '%')
      ))
      OR
      -- If no filters, return all matching products
      (search_query IS NULL AND search_sku IS NULL AND search_ean IS NULL AND search_category IS NULL)
    )
  ORDER BY 
    -- Prioritize exact matches
    CASE 
      WHEN search_sku IS NOT NULL AND mp.sku = search_sku THEN 1
      WHEN search_ean IS NOT NULL AND mp.barcode_ean = search_ean THEN 2
      ELSE 3
    END,
    mp.name ASC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_master_products TO authenticated;

COMMIT;

