-- Fix RLS policies to allow agents to read orgs they have agent relationships with
-- 
-- Issue: agent_relationships queries with joins to orgs table fail because:
-- 1. RLS was disabled on agent_relationships (now enabled)
-- 2. orgs RLS policies don't allow agents to read orgs they're agents for
--
-- This migration adds policies to allow:
-- - Agents to read orgs where they have active agent relationships
-- - Helpers (users with portal permissions) to read orgs via their helper relationships

BEGIN;

-- Ensure RLS is enabled on agent_relationships (should already be enabled, but safe to repeat)
ALTER TABLE public.agent_relationships ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can read orgs they have agent relationships with
-- This allows the join in agent_relationships queries to succeed
DROP POLICY IF EXISTS "orgs_agent_read" ON public.orgs;
CREATE POLICY "orgs_agent_read" ON public.orgs
FOR SELECT
USING (
  id IN (
    SELECT sender_org_id 
    FROM public.agent_relationships 
    WHERE agent_user_id = auth.uid() 
      AND status = 'active'
  )
);

-- Policy: Helpers can read orgs via their portal permissions
DROP POLICY IF EXISTS "orgs_helper_read" ON public.orgs;
CREATE POLICY "orgs_helper_read" ON public.orgs
FOR SELECT
USING (
  id IN (
    SELECT ar.sender_org_id 
    FROM public.agent_relationships ar
    INNER JOIN public.agent_portal_permissions app ON app.agent_relationship_id = ar.id
    WHERE app.helper_user_id = auth.uid()
      AND ar.status = 'active'
  )
);

COMMIT;

