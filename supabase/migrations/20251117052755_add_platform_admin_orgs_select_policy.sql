-- Add RLS policy to allow platform admins to SELECT orgs for GST verification
-- Platform admins need to read orgs with unverified GSTINs to verify them

BEGIN;

-- Platform admins can read all orgs (for GST verification queue)
CREATE POLICY "Platform admins can read orgs for verification"
ON public.orgs
FOR SELECT
TO authenticated
USING (public.current_user_is_platform_admin());

COMMIT;

