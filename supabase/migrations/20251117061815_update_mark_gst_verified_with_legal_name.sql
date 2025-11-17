-- Update mark_gst_verified RPC to accept and store legal_name and address
-- These fields become immutable after GST verification

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_gst_verified(
  p_org_id uuid,
  p_verification_notes text,
  p_legal_name text DEFAULT NULL,
  p_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only platform admins can call this
  IF NOT public.current_user_is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access required';
  END IF;

  -- Notes are required
  IF p_verification_notes IS NULL OR trim(p_verification_notes) = '' THEN
    RAISE EXCEPTION 'Verification notes are required';
  END IF;

  -- Update org with verification status and immutable GST data
  UPDATE public.orgs
  SET
    gst_verification_status = 'verified',
    gst_verification_source = COALESCE(gst_verification_source, 'manual'),
    gst_verified_at = now(),
    gst_verified_by = auth.uid(),
    gst_verification_notes = trim(p_verification_notes),
    -- Store legal_name and address from GST portal (immutable after verification)
    legal_name = COALESCE(p_legal_name, legal_name),
    address = COALESCE(p_address, address),
    updated_at = now()
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
END;
$$;

COMMIT;

