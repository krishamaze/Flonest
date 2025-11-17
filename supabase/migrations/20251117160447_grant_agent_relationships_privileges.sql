
BEGIN;

-- Grant necessary privileges to authenticated role so RLS policies can evaluate.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_portal_permissions TO authenticated;

COMMIT;

