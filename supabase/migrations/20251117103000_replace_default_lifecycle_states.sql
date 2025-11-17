-- Migration: add explicit lifecycle state tracking without touching geographic state values

BEGIN;

-- Add lifecycle_state column with explicit enum enforcement
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'onboarding_pending'
    CHECK (lifecycle_state IN ('onboarding_pending', 'active', 'suspended', 'archived'));

-- Initialize lifecycle state for existing orgs (non-Default means already active)
UPDATE public.orgs
SET lifecycle_state = CASE
  WHEN state = 'Default' OR state IS NULL THEN 'onboarding_pending'
  ELSE 'active'
END
WHERE lifecycle_state = 'onboarding_pending';

-- Ensure only one org_owner per org
DROP INDEX IF EXISTS idx_orgs_unique_owner;
CREATE UNIQUE INDEX idx_orgs_unique_owner
  ON public.memberships (org_id)
  WHERE role = 'org_owner' AND membership_status = 'active';

-- Update create_default_org_for_user to set lifecycle_state explicitly
CREATE OR REPLACE FUNCTION public.create_default_org_for_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
  v_org_name text;
  v_org_slug text;
  v_org_record public.orgs%ROWTYPE;
  v_membership_record public.memberships%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Please create profile first.';
  END IF;

  SELECT id INTO v_membership_id
  FROM public.memberships
  WHERE profile_id = v_user_id
    AND membership_status = 'active'
  LIMIT 1;

  IF v_membership_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a membership';
  END IF;

  v_org_name := 'test-' || left(v_user_id::text, 8);
  v_org_slug := 'test-' || left(v_user_id::text, 8);

  INSERT INTO public.orgs (name, slug, state, lifecycle_state, gst_enabled)
  VALUES (v_org_name, v_org_slug, 'Default', 'onboarding_pending', false)
  RETURNING * INTO v_org_record;

  v_org_id := v_org_record.id;

  INSERT INTO public.memberships (profile_id, org_id, role, membership_status)
  VALUES (v_profile_id, v_org_id, 'org_owner', 'active')
  RETURNING * INTO v_membership_record;

  v_membership_id := v_membership_record.id;

  RETURN json_build_object(
    'org_id', v_org_id,
    'membership_id', v_membership_id,
    'org', row_to_json(v_org_record),
    'membership', row_to_json(v_membership_record)
  );
END;
$$;

COMMIT;

