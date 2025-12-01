-- Fix search_org_customers to exclude soft-deleted customers
-- Root cause: Search was showing deleted customers because the RPC didn't filter by deleted_at

CREATE OR REPLACE FUNCTION public.search_org_customers(
  p_org_id uuid,
  p_query text
)
RETURNS TABLE (
  id uuid,
  name text,
  mobile text,
  gstin text,
  status text,
  last_invoice_date timestamptz,
  master_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    COALESCE(c.name, c.alias_name, mc.legal_name) as name,
    COALESCE(c.mobile, mc.mobile) as mobile,
    COALESCE(c.gst_number, mc.gstin) as gstin,
    c.status,
    c.last_invoice_date,
    mc.legal_name as master_name
  FROM customers c
  LEFT JOIN master_customers mc ON c.master_customer_id = mc.id
  WHERE 
    c.org_id = p_org_id
    AND c.deleted_at IS NULL  -- ← ADDED: Exclude soft-deleted customers
    AND (
      (p_query IS NULL OR LENGTH(p_query) < 3) -- Return nothing if query too short
      OR
      (
        (c.mobile ILIKE p_query || '%') OR
        (c.gst_number ILIKE '%' || p_query || '%') OR
        (c.name ILIKE '%' || p_query || '%') OR
        (c.alias_name ILIKE '%' || p_query || '%') OR
        (mc.mobile ILIKE p_query || '%') OR
        (mc.gstin ILIKE '%' || p_query || '%') OR
        (mc.legal_name ILIKE '%' || p_query || '%')
      )
    )
  ORDER BY 
    c.last_invoice_date DESC NULLS LAST,
    c.name ASC
  LIMIT 10;
END;
$$;
