-- Fix RLS policies for billing tables to allow authenticated users to read their own org's data
-- This replaces the service_role-only approach with proper org-scoped policies

-- Drop existing service_role-only policies
DROP POLICY IF EXISTS "billing_plans_service_role_only" ON public.billing_plans;
DROP POLICY IF EXISTS "org_subscriptions_service_role_only" ON public.org_subscriptions;
DROP POLICY IF EXISTS "subscription_events_service_role_only" ON public.subscription_events;

-- Grant SELECT permissions to authenticated role
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT ON public.org_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;

-- billing_plans: Public catalog - authenticated users can read active plans
CREATE POLICY "billing_plans_read_active"
ON public.billing_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- org_subscriptions: Org members can read their own org's subscription
-- Uses is_org_member() SECURITY DEFINER function to bypass memberships RLS
CREATE POLICY "org_subscriptions_read_own_org"
ON public.org_subscriptions
FOR SELECT
TO authenticated
USING (public.is_org_member(org_id, auth.uid()));

-- subscription_events: Org members can read events for their org's subscription
-- Uses is_org_member() SECURITY DEFINER function to bypass memberships RLS
CREATE POLICY "subscription_events_read_own_org"
ON public.subscription_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.org_subscriptions os
    WHERE os.id = subscription_events.org_subscription_id
      AND public.is_org_member(os.org_id, auth.uid())
  )
);

-- Write operations remain service_role only (via RPCs/Edge Functions)
-- This prevents clients from directly modifying billing data

