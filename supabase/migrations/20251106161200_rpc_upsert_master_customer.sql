-- M4: RPC function to upsert master_customers
-- SECURITY DEFINER allows writes to read-only master table
-- Handles conflicts on mobile and GSTIN

BEGIN;

CREATE OR REPLACE FUNCTION upsert_master_customer(
  p_mobile text,
  p_gstin text,
  p_legal_name text,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_state_code text;
  v_pan text;
BEGIN
  -- Derive state_code and PAN from GSTIN if provided
  IF p_gstin IS NOT NULL AND length(p_gstin) >= 7 THEN
    v_state_code := substring(p_gstin, 1, 2);
    v_pan := substring(p_gstin, 3, 5);
  END IF;

  -- Try to insert/update by mobile first (if provided)
  IF p_mobile IS NOT NULL THEN
    INSERT INTO master_customers (mobile, gstin, legal_name, address, email, state_code, pan, last_seen_at)
    VALUES (p_mobile, p_gstin, p_legal_name, p_address, p_email, v_state_code, v_pan, now())
    ON CONFLICT (mobile) WHERE mobile IS NOT NULL
      DO UPDATE SET 
        last_seen_at = now(),
        updated_at = now(),
        -- Update fields if provided and not already set
        legal_name = COALESCE(EXCLUDED.legal_name, master_customers.legal_name),
        address = COALESCE(EXCLUDED.address, master_customers.address),
        email = COALESCE(EXCLUDED.email, master_customers.email),
        gstin = COALESCE(EXCLUDED.gstin, master_customers.gstin),
        state_code = COALESCE(EXCLUDED.state_code, master_customers.state_code),
        pan = COALESCE(EXCLUDED.pan, master_customers.pan)
      RETURNING id INTO v_id;
  END IF;

  -- If mobile upsert didn't work and GSTIN is provided, try GSTIN
  IF v_id IS NULL AND p_gstin IS NOT NULL THEN
    INSERT INTO master_customers (mobile, gstin, legal_name, address, email, state_code, pan, last_seen_at)
    VALUES (p_mobile, p_gstin, p_legal_name, p_address, p_email, v_state_code, v_pan, now())
    ON CONFLICT (gstin) WHERE gstin IS NOT NULL
      DO UPDATE SET 
        last_seen_at = now(),
        updated_at = now(),
        -- Update fields if provided and not already set
        legal_name = COALESCE(EXCLUDED.legal_name, master_customers.legal_name),
        address = COALESCE(EXCLUDED.address, master_customers.address),
        email = COALESCE(EXCLUDED.email, master_customers.email),
        mobile = COALESCE(EXCLUDED.mobile, master_customers.mobile),
        state_code = COALESCE(EXCLUDED.state_code, master_customers.state_code),
        pan = COALESCE(EXCLUDED.pan, master_customers.pan)
      RETURNING id INTO v_id;
  END IF;

  -- If still no ID, it's a new record (insert without conflict)
  IF v_id IS NULL THEN
    INSERT INTO master_customers (mobile, gstin, legal_name, address, email, state_code, pan, last_seen_at)
    VALUES (p_mobile, p_gstin, p_legal_name, p_address, p_email, v_state_code, v_pan, now())
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_master_customer TO authenticated;

COMMIT;

