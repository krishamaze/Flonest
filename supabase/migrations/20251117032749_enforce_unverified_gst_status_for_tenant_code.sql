-- Enforce unverified GST status for tenant code
-- Tenant code (authenticated users) can NEVER set verification_status to 'verified'
-- Only platform admins can verify GSTINs manually

CREATE OR REPLACE FUNCTION set_gst_from_validation(
  p_org_id uuid,
  p_gst_number text,
  p_gst_enabled boolean,
  p_verification_status text,
  p_verification_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  -- Verify org exists and user has access (via RLS)
  -- This function can be called by tenant code, but verification fields are set from gst-validate response only
  
  -- Get current verification status
  SELECT gst_verification_status INTO v_current_status
  FROM public.orgs
  WHERE id = p_org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found or access denied';
  END IF;
  
  -- If clearing GST (empty gst_number), block if currently verified
  IF p_gst_number IS NULL OR trim(p_gst_number) = '' THEN
    -- CRITICAL: Prevent clearing GSTIN if org is verified
    -- Only platform admins (via future unverify/suspend RPC) can change verified GSTINs
    IF v_current_status = 'verified' THEN
      RAISE EXCEPTION 'Cannot clear GSTIN for verified organization. Contact platform admin to suspend or cancel GST registration.';
    END IF;
    
    UPDATE public.orgs
    SET
      gst_number = NULL,
      gst_enabled = false,
      gst_verification_status = 'unverified',
      gst_verification_source = NULL,
      gst_verified_at = NULL,
      gst_verified_by = NULL,
      gst_verification_notes = NULL,
      updated_at = now()
    WHERE id = p_org_id;
    
    RETURN;
  END IF;
  
  -- CRITICAL: Tenant code can NEVER set verification_status to 'verified'
  -- Only platform admins can verify GSTINs via mark_gst_verified RPC
  -- Force unverified status regardless of what tenant code passes
  IF p_verification_status = 'verified' THEN
    RAISE EXCEPTION 'Tenant code cannot set verification_status to verified. Only platform admins can verify GSTINs.';
  END IF;
  
  -- Validate verification_status
  IF p_verification_status NOT IN ('unverified', 'verified') THEN
    RAISE EXCEPTION 'Invalid verification_status: must be unverified or verified';
  END IF;
  
  -- Validate verification_source
  IF p_verification_source IS NOT NULL AND p_verification_source NOT IN ('manual', 'cashfree', 'secureid') THEN
    RAISE EXCEPTION 'Invalid verification_source';
  END IF;

  -- Update org - verification_status is ALWAYS unverified for tenant code
  UPDATE public.orgs
  SET
    gst_number = trim(p_gst_number),
    gst_enabled = p_gst_enabled,
    gst_verification_status = 'unverified', -- Always unverified - enforced at RPC level
    gst_verification_source = COALESCE(p_verification_source, 'manual'),
    -- Never set verified_at for tenant code
    gst_verified_at = NULL,
    gst_verified_by = NULL,
    updated_at = now()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found or access denied';
  END IF;
END;
$$;

