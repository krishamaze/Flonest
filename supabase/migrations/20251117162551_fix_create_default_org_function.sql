-- Migration: Fix create_default_org_for_user to allow multiple orgs per user

BEGIN;

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
  v_attempts integer := 0;
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

  v_org_name := 'My Business';

  LOOP
    v_attempts := v_attempts + 1;
    v_org_slug := 'org-' || left(v_user_id::text, 8) || '-' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;

    BEGIN
      INSERT INTO public.orgs (name, slug, state, gst_enabled, lifecycle_state)
      VALUES (v_org_name, v_org_slug, 'TN', false, 'onboarding_pending')
      RETURNING * INTO v_org_record;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempts >= 5 THEN
          RAISE EXCEPTION 'Unable to generate unique org slug';
        END IF;
        PERFORM pg_sleep(0.01);
    END;
  END LOOP;

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

GRANT EXECUTE ON FUNCTION public.create_default_org_for_user() TO authenticated;

COMMENT ON FUNCTION public.create_default_org_for_user() IS 
'Creates a new organization for the current user. Supports multiple calls per user and generates a unique slug each time.';

COMMIT;

