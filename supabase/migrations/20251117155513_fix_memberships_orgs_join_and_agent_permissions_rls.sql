-- Fix RLS policies for memberships→orgs joins and agent_portal_permissions
-- 
-- Issues:
-- 1. memberships queries with orgs!inner() joins fail because orgs RLS policy uses is_org_member()
--    which may not work correctly in PostgREST join context
-- 2. agent_portal_permissions table has RLS disabled and no policies
--
-- This migration:
-- 1. Adds a direct orgs policy for members (not using is_org_member function)
-- 2. Enables RLS on agent_portal_permissions and adds proper policies

BEGIN;

-- =====================================================
-- Fix orgs RLS for memberships joins
-- =====================================================

-- The existing "Users can read orgs via membership" policy uses is_org_member() function
-- PostgREST may have issues with SECURITY DEFINER functions in RLS policies during joins
-- Add a direct policy that doesn't rely on the function for better compatibility
DROP POLICY IF EXISTS "orgs_members_read_direct" ON public.orgs;
CREATE POLICY "orgs_members_read_direct" ON public.orgs
FOR SELECT
USING (
  id IN (
    SELECT org_id 
    FROM public.memberships 
    WHERE profile_id = auth.uid() 
      AND membership_status = 'active'
  )
);

-- =====================================================
-- Fix agent_portal_permissions RLS
-- =====================================================

-- Enable RLS on agent_portal_permissions
ALTER TABLE public.agent_portal_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can manage permissions for their relationships
DROP POLICY IF EXISTS "agent_portal_permissions_agent_manage" ON public.agent_portal_permissions;
CREATE POLICY "agent_portal_permissions_agent_manage" ON public.agent_portal_permissions
FOR ALL
USING (
  agent_relationship_id IN (
    SELECT id FROM public.agent_relationships
    WHERE agent_user_id = auth.uid()
  )
);

-- Policy: Helpers can view their own permissions
DROP POLICY IF EXISTS "agent_portal_permissions_helper_view" ON public.agent_portal_permissions;
CREATE POLICY "agent_portal_permissions_helper_view" ON public.agent_portal_permissions
FOR SELECT
USING (helper_user_id = auth.uid());

-- Policy: Sender org owners can view permissions for their agent relationships
DROP POLICY IF EXISTS "agent_portal_permissions_sender_view" ON public.agent_portal_permissions;
CREATE POLICY "agent_portal_permissions_sender_view" ON public.agent_portal_permissions
FOR SELECT
USING (
  agent_relationship_id IN (
    SELECT ar.id 
    FROM public.agent_relationships ar
    INNER JOIN public.memberships m ON m.org_id = ar.sender_org_id
    WHERE m.profile_id = auth.uid()
      AND m.role = 'org_owner'
      AND m.membership_status = 'active'
  )
);

COMMIT;

