-- Create upsert_master_customer RPC function
-- This function creates or updates a master customer record

CREATE OR REPLACE FUNCTION public.upsert_master_customer(
  p_mobile text,
  p_gstin text,
  p_legal_name text,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_id uuid;
BEGIN
  -- Validate: at least one identifier (mobile or GSTIN) must be provided
  IF p_mobile IS NULL AND p_gstin IS NULL THEN
    RAISE EXCEPTION 'At least one identifier (mobile or GSTIN) is required';
  END IF;

  -- Validate: legal_name is required
  IF p_legal_name IS NULL OR trim(p_legal_name) = '' THEN
    RAISE EXCEPTION 'Legal name is required';
  END IF;

  -- Try to find existing master customer by mobile or GSTIN
  IF p_mobile IS NOT NULL THEN
    SELECT id INTO v_master_id
    FROM public.master_customers
    WHERE mobile = p_mobile
    LIMIT 1;
  END IF;

  IF v_master_id IS NULL AND p_gstin IS NOT NULL THEN
    SELECT id INTO v_master_id
    FROM public.master_customers
    WHERE gstin = p_gstin
    LIMIT 1;
  END IF;

  -- If found, update the record
  IF v_master_id IS NOT NULL THEN
    UPDATE public.master_customers
    SET
      mobile = COALESCE(p_mobile, mobile),
      gstin = COALESCE(p_gstin, gstin),
      legal_name = COALESCE(p_legal_name, legal_name),
      address = COALESCE(p_address, address),
      email = COALESCE(p_email, email),
      updated_at = now()
    WHERE id = v_master_id;
  ELSE
    -- If not found, insert new record
    INSERT INTO public.master_customers (
      mobile,
      gstin,
      legal_name,
      address,
      email,
      created_at,
      updated_at
    )
    VALUES (
      p_mobile,
      p_gstin,
      p_legal_name,
      p_address,
      p_email,
      now(),
      now()
    )
    RETURNING id INTO v_master_id;
  END IF;

  RETURN v_master_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.upsert_master_customer IS 
  'Creates or updates a master customer record. Returns the master customer ID.';
