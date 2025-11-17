
-- Resolve infinite recursion between agent_relationships, agent_portal_permissions, and orgs RLS policies
-- by introducing SECURITY DEFINER helper functions and rebuilding the policies to use them.

BEGIN;

-- =====================================================
-- Helper functions to evaluate access without triggering RLS recursion
-- =====================================================

CREATE OR REPLACE FUNCTION public.current_user_is_agent_for_relationship(p_relationship_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_relationships ar
    WHERE ar.id = p_relationship_id
      AND ar.agent_user_id = auth.uid()
      AND ar.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_helper_for_relationship(p_relationship_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_portal_permissions app
    WHERE app.agent_relationship_id = p_relationship_id
      AND app.helper_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_sender_owner_for_relationship(p_relationship_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_relationships ar
    JOIN public.memberships m ON m.org_id = ar.sender_org_id
    WHERE ar.id = p_relationship_id
      AND m.profile_id = auth.uid()
      AND m.role = 'org_owner'
      AND m.membership_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_agent_for_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_relationships ar
    WHERE ar.sender_org_id = p_org_id
      AND ar.agent_user_id = auth.uid()
      AND ar.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_helper_for_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_relationships ar
    JOIN public.agent_portal_permissions app ON app.agent_relationship_id = ar.id
    WHERE ar.sender_org_id = p_org_id
      AND ar.status = 'active'
      AND app.helper_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_agent_for_relationship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_helper_for_relationship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_sender_owner_for_relationship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_agent_for_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_helper_for_org(uuid) TO authenticated;

-- =====================================================
-- Rebuild agent_relationships policies to use helper functions
-- =====================================================

DROP POLICY IF EXISTS "agent_relationships_helper_view" ON public.agent_relationships;
CREATE POLICY "agent_relationships_helper_view" ON public.agent_relationships
FOR SELECT
USING (
  public.current_user_is_helper_for_relationship(id)
);

DROP POLICY IF EXISTS "agent_relationships_sender_owner_manage" ON public.agent_relationships;
CREATE POLICY "agent_relationships_manage" ON public.agent_relationships
FOR ALL
USING (
  public.current_user_is_agent_for_relationship(id)
  OR public.current_user_is_sender_owner_for_relationship(id)
);

-- Agent view policy remains unchanged (agent_user_id = auth.uid())

-- =====================================================
-- Rebuild agent_portal_permissions policies to avoid referencing agent_relationships directly
-- =====================================================

DROP POLICY IF EXISTS "agent_portal_permissions_agent_manage" ON public.agent_portal_permissions;
CREATE POLICY "agent_portal_permissions_agent_manage" ON public.agent_portal_permissions
FOR ALL
USING (
  public.current_user_is_agent_for_relationship(agent_relationship_id)
);

DROP POLICY IF EXISTS "agent_portal_permissions_sender_view" ON public.agent_portal_permissions;
CREATE POLICY "agent_portal_permissions_sender_view" ON public.agent_portal_permissions
FOR SELECT
USING (
  public.current_user_is_sender_owner_for_relationship(agent_relationship_id)
);

-- Helper view policy (helper_user_id = auth.uid()) remains valid.

-- =====================================================
-- Update orgs helper/agent policies to rely on helper functions
-- =====================================================

DROP POLICY IF EXISTS "orgs_agent_read" ON public.orgs;
CREATE POLICY "orgs_agent_read" ON public.orgs
FOR SELECT
USING (
  public.current_user_is_agent_for_org(id)
);

DROP POLICY IF EXISTS "orgs_helper_read" ON public.orgs;
CREATE POLICY "orgs_helper_read" ON public.orgs
FOR SELECT
USING (
  public.current_user_is_helper_for_org(id)
);

COMMIT;

