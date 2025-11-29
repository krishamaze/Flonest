-- Add status to master_customers
ALTER TABLE public.master_customers 
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('verified', 'pending_review', 'rejected')) DEFAULT 'verified';

-- Add columns to customers (org_customers)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('name_only', 'edited', 'verified')) DEFAULT 'verified',
ADD COLUMN IF NOT EXISTS last_invoice_date timestamptz,
ADD COLUMN IF NOT EXISTS mobile text,
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS change_request_id uuid;

-- Allow NULL master_customer_id
ALTER TABLE public.customers ALTER COLUMN master_customer_id DROP NOT NULL;

-- Create customer_change_requests table
CREATE TABLE IF NOT EXISTS public.customer_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_customer_id uuid REFERENCES public.customers(id),
  requested_by_org_id uuid REFERENCES public.orgs(id),
  action_type text CHECK (action_type IN ('create_new', 'update_existing')),
  status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view change requests for their org" ON public.customer_change_requests;
CREATE POLICY "Users can view change requests for their org" ON public.customer_change_requests
  FOR SELECT USING (
    requested_by_org_id IN (
      SELECT org_id FROM memberships WHERE profile_id = auth.uid()
    )
  );

-- Function to add new party (Task 5 logic)
CREATE OR REPLACE FUNCTION public.add_org_customer(
  p_org_id uuid,
  p_name text,
  p_mobile text DEFAULT NULL,
  p_gstin text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_master_id uuid;
  v_customer_id uuid;
  v_status text;
  v_change_request_id uuid;
BEGIN
  -- 1. Check if mobile OR GST already exists in master_customers
  SELECT id INTO v_master_id
  FROM public.master_customers
  WHERE (p_mobile IS NOT NULL AND mobile = p_mobile)
     OR (p_gstin IS NOT NULL AND gstin = p_gstin)
  LIMIT 1;

  -- 2. Determine status and master link
  IF v_master_id IS NOT NULL THEN
    v_status := 'verified';
    
    INSERT INTO public.customers (
      org_id,
      master_customer_id,
      name,
      alias_name, -- Populate alias_name with name for backward compatibility
      mobile,
      gst_number,
      status,
      created_by
    ) VALUES (
      p_org_id,
      v_master_id,
      p_name,
      p_name,
      p_mobile,
      p_gstin,
      v_status,
      auth.uid()
    ) RETURNING id INTO v_customer_id;
    
  ELSE
    -- No master match
    IF p_mobile IS NULL AND p_gstin IS NULL THEN
      v_status := 'name_only';
    ELSE
      v_status := 'edited'; 
    END IF;

    INSERT INTO public.customers (
      org_id,
      master_customer_id,
      name,
      alias_name,
      mobile,
      gst_number,
      status,
      created_by
    ) VALUES (
      p_org_id,
      NULL,
      p_name,
      p_name,
      p_mobile,
      p_gstin,
      v_status,
      auth.uid()
    ) RETURNING id INTO v_customer_id;

    -- Create change request if edited
    IF v_status = 'edited' THEN
      INSERT INTO public.customer_change_requests (
        org_customer_id,
        requested_by_org_id,
        action_type,
        status
      ) VALUES (
        v_customer_id,
        p_org_id,
        'create_new',
        'pending'
      ) RETURNING id INTO v_change_request_id;
      
      UPDATE public.customers 
      SET change_request_id = v_change_request_id
      WHERE id = v_customer_id;
    END IF;
  END IF;

  RETURN v_customer_id;
END;
$$;

-- Function to search org customers (Task 3 update)
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
    AND (
      (p_query IS NULL OR LENGTH(p_query) < 3) -- Return nothing if query too short (or handle in client)
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

