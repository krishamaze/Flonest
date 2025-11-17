-- Grant missing permissions to authenticated role on tables with RLS policies
-- These tables have INSERT/UPDATE/DELETE policies but missing GRANT statements

-- master_products: UPDATE policy exists, missing UPDATE grant
GRANT UPDATE ON public.master_products TO authenticated;

-- notifications: INSERT/UPDATE/DELETE policies exist, missing grants
GRANT INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

