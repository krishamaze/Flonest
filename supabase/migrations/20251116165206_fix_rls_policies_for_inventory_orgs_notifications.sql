-- Fix RLS policies for inventory, orgs UPDATE, and notifications INSERT

-- 1) INVENTORY: Enable RLS and add policies for org members
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Org members access inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members select inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Org members delete inventory" ON public.inventory;

-- SELECT: Org members can view inventory for their orgs
CREATE POLICY "Org members select inventory"
  ON public.inventory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = inventory.org_id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  );

-- INSERT: Org members can add inventory for their orgs
CREATE POLICY "Org members insert inventory"
  ON public.inventory
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = inventory.org_id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  );

-- UPDATE: Org members can update inventory for their orgs
CREATE POLICY "Org members update inventory"
  ON public.inventory
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = inventory.org_id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = inventory.org_id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  );

-- DELETE: Org members can delete inventory for their orgs
CREATE POLICY "Org members delete inventory"
  ON public.inventory
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = inventory.org_id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  );

-- 2) ORGS: Add UPDATE policy (SELECT already exists)
DROP POLICY IF EXISTS "Org members update org" ON public.orgs;

CREATE POLICY "Org members update org"
  ON public.orgs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = orgs.id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.memberships
      WHERE memberships.org_id = orgs.id
        AND memberships.profile_id = auth.uid()
        AND memberships.membership_status = 'active'
    )
  );

-- 3) NOTIFICATIONS: Fix INSERT policy to have proper WITH CHECK clause
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

CREATE POLICY "Users insert own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

