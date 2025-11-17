BEGIN;

-- Add explicit lifecycle_state column to orgs table
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS lifecycle_state text;

UPDATE public.orgs
SET lifecycle_state = CASE
  WHEN lifecycle_state IS NOT NULL THEN lifecycle_state
  WHEN state = 'Default' THEN 'onboarding_pending'
  ELSE 'active'
END;

ALTER TABLE public.orgs
  ALTER COLUMN lifecycle_state SET NOT NULL,
  ALTER COLUMN lifecycle_state SET DEFAULT 'onboarding_pending';

ALTER TABLE public.orgs
  DROP CONSTRAINT IF EXISTS orgs_state_lifecycle_check,
  DROP CONSTRAINT IF EXISTS orgs_lifecycle_state_check;

ALTER TABLE public.orgs
  ADD CONSTRAINT orgs_lifecycle_state_check
  CHECK (lifecycle_state IN ('onboarding_pending', 'active', 'suspended', 'archived'));

CREATE INDEX IF NOT EXISTS idx_orgs_lifecycle_state
ON public.orgs (lifecycle_state);

-- Update default org creation RPC to populate lifecycle_state
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

  v_org_name := 'test-' || left(v_user_id::text, 8);
  v_org_slug := 'test-' || left(v_user_id::text, 8);

  INSERT INTO public.orgs (name, slug, state, lifecycle_state, gst_enabled)
  VALUES (v_org_name, v_org_slug, NULL, 'onboarding_pending', false)
  RETURNING * INTO v_org_record;

  v_org_id := v_org_record.id;

  INSERT INTO public.memberships (profile_id, org_id, role, membership_status)
  VALUES (v_profile_id, v_org_id, 'org_owner', 'active')
  RETURNING * INTO v_membership_record;

  RETURN json_build_object(
    'org_id', v_org_id,
    'membership_id', v_membership_record.id,
    'org', row_to_json(v_org_record),
    'membership', row_to_json(v_membership_record)
  );
END;
$$;

-- Ensure only one active org_owner per organization (reuse canonical index name)
DROP INDEX IF EXISTS memberships_single_owner_idx;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_unique_owner
ON public.memberships (org_id)
WHERE role = 'org_owner' AND membership_status = 'active';

COMMIT;
