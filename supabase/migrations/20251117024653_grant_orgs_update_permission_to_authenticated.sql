-- Grant UPDATE permission to authenticated role on orgs table
-- RLS UPDATE policy already exists from 20251116165206_fix_rls_policies_for_inventory_orgs_notifications.sql
-- This migration adds the missing GRANT UPDATE statement that allows authenticated users to update orgs

GRANT UPDATE ON public.orgs TO authenticated;

