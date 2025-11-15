-- Migration: Add RLS to billing tables to prevent unauthorized access
-- CRITICAL: Billing tables currently have no RLS, allowing any authenticated user to read/modify subscription data
--
-- Security risk:
-- - billing_plans, org_subscriptions, subscription_events are readable/writable by any authenticated user
-- - This allows billing fraud (modifying subscription status, plan prices) and PII leaks
--
-- This migration:
-- 1. Enables RLS on all billing tables
-- 2. Grants access only to service_role (for backend automation)
-- 3. Blocks all anon/authenticated access (client must use RPCs if read-only plan metadata needed later)

BEGIN;

-- Step 1: Enable RLS on billing_plans
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- Step 2: Enable RLS on org_subscriptions  
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

-- Step 3: Enable RLS on subscription_events
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policy for billing_plans - service role only
-- Note: billing_plans is a catalog table, but we still lock it down
-- If UI needs to display plan metadata, create a read-only RPC later
CREATE POLICY "billing_plans_service_role_only"
ON public.billing_plans
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Step 5: Create policy for org_subscriptions - service role only
-- Organizations can only access their own subscription via RPCs (not direct queries)
CREATE POLICY "org_subscriptions_service_role_only"
ON public.org_subscriptions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Step 6: Create policy for subscription_events - service role only
-- Events are audit logs - only backend should write/read
CREATE POLICY "subscription_events_service_role_only"
ON public.subscription_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Step 7: Verify RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'billing_plans'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on billing_plans';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'org_subscriptions'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on org_subscriptions';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'subscription_events'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on subscription_events';
  END IF;
  
  RAISE NOTICE 'RLS enabled on all billing tables - access restricted to service_role';
END $$;

COMMIT;

