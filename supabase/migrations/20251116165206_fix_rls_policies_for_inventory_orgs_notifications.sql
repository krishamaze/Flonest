-- Fix RLS policies for inventory, orgs UPDATE, and notifications INSERT
-- 
-- IMPORTANT: This migration uses is_org_member() SECURITY DEFINER function to bypass
-- memberships table RLS. If the function doesn't exist yet, it will be created by
-- the add_membership_check_function migration which runs after this one.
--
-- Using EXISTS subqueries directly fails because memberships table RLS blocks those checks.
-- The correct approach (documented in engineering-playbook.mdc) is to use SECURITY DEFINER
-- functions like is_org_member() to bypass RLS on cross-table checks.

-- Ensure is_org_member() function exists (created by later migration, but this ensures it works)
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE org_id = p_org_id
      AND profile_id = p_user_id
      AND membership_status = 'active'
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

-- 1) INVENTORY: Enable RLS and add policies for org members
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Org members access inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members select inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members delete inventory" ON public.inventory;

-- SELECT: Org members can view inventory for their orgs
-- Uses is_org_member() SECURITY DEFINER function to bypass memberships RLS
CREATE POLICY "Org members select inventory"
  ON public.inventory
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

-- INSERT: Org members can add inventory for their orgs
CREATE POLICY "Org members insert inventory"
  ON public.inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- UPDATE: Org members can update inventory for their orgs
CREATE POLICY "Org members update inventory"
  ON public.inventory
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- DELETE: Org members can delete inventory for their orgs
CREATE POLICY "Org members delete inventory"
  ON public.inventory
  FOR DELETE
  TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

-- 2) ORGS: Add UPDATE policy (SELECT already exists)
DROP POLICY IF EXISTS "Org members update org" ON public.orgs;

CREATE POLICY "Org members update org"
  ON public.orgs
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(id, auth.uid()))
  WITH CHECK (public.is_org_member(id, auth.uid()));

-- 3) NOTIFICATIONS: Fix INSERT policy to have proper WITH CHECK clause
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

CREATE POLICY "Users insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

