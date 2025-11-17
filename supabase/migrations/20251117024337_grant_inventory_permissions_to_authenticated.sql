-- Grant permissions to authenticated role on inventory table
-- RLS policies already exist from 20251116165206_fix_rls_policies_for_inventory_orgs_notifications.sql
-- This migration adds the missing GRANT statements that allow authenticated users to access the table

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;

