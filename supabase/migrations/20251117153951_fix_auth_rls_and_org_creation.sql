-- Fix agent_relationships RLS policies and create_default_org_for_user state issue
-- 
-- Issues fixed:
-- 1. agent_relationships table has RLS enabled but no policies, causing 403 errors
-- 2. create_default_org_for_user inserts 'Default' as state, but state column expects Indian state codes
-- 3. RLS policies in legacy migrations check for role='admin' but actual role is 'org_owner'

BEGIN;

-- =====================================================
-- Fix agent_relationships RLS policies
-- =====================================================

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "agent_relationships_sender_admin_manage" ON public.agent_relationships;
DROP POLICY IF EXISTS "agent_relationships_agent_view" ON public.agent_relationships;
DROP POLICY IF EXISTS "agent_relationships_helper_view" ON public.agent_relationships;

-- Policy: Sender org owners can manage agent relationships for their org
CREATE POLICY "agent_relationships_sender_owner_manage" ON public.agent_relationships
FOR ALL
USING (
  sender_org_id IN (
    SELECT org_id FROM public.memberships
    WHERE profile_id = auth.uid()
      AND role = 'org_owner'
      AND membership_status = 'active'
  )
);

-- Policy: Agents can view their own relationships
CREATE POLICY "agent_relationships_agent_view" ON public.agent_relationships
FOR SELECT
USING (agent_user_id = auth.uid());

-- Policy: Agents' helpers can view relationships if they have portal permissions
CREATE POLICY "agent_relationships_helper_view" ON public.agent_relationships
FOR SELECT
USING (
  id IN (
    SELECT agent_relationship_id FROM public.agent_portal_permissions
    WHERE helper_user_id = auth.uid()
  )
);

-- =====================================================
-- Fix create_default_org_for_user to use valid state code
-- =====================================================

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
  LIMIT 1;

  IF v_membership_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a membership';
  END IF;

  v_org_name := 'test-' || left(v_user_id::text, 8);
  v_org_slug := 'test-' || left(v_user_id::text, 8);

  -- Use 'TN' (Tamil Nadu) as default state code instead of 'Default'
  -- Users can update this during org setup
  INSERT INTO public.orgs (name, slug, state, gst_enabled, lifecycle_state)
  VALUES (v_org_name, v_org_slug, 'TN', false, 'onboarding_pending')
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

