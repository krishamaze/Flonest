-- Fix RLS policies for invoices to support upsert operations
-- Upsert requires SELECT, INSERT, and UPDATE policies with matching conditions

BEGIN;

-- Drop existing FOR ALL policy
DROP POLICY IF EXISTS "Invoices: Users can manage org invoices" ON invoices;

-- SELECT policy (REQUIRED for upsert to check if row exists)
-- Must allow selecting drafts from user's org
CREATE POLICY "Invoices: Users can select org invoices"
ON invoices FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- INSERT policy (allows creating new drafts)
-- Must use same org check as SELECT
CREATE POLICY "Invoices: Users can insert org invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- UPDATE policy (allows updating existing drafts)
-- CRITICAL: USING condition must match SELECT policy exactly
-- WITH CHECK ensures updated data also passes org check
CREATE POLICY "Invoices: Users can update org invoices"
ON invoices FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

-- DELETE policy (allows deleting drafts)
CREATE POLICY "Invoices: Users can delete org invoices"
ON invoices FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT m.org_id FROM memberships m
    INNER JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()
  )
);

COMMIT;

