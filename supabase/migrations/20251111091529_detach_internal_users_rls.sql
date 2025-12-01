-- Migration: Detach internal users from org context
-- Add RLS policy to allow internal users to read invoices (for blocked invoices feature)
-- Internal users can SELECT invoices but cannot INSERT/UPDATE/DELETE

BEGIN;

-- Policy: Internal users can SELECT invoices (read-only access for blocked invoices review)
CREATE POLICY "invoices_read_internal" ON invoices
FOR SELECT
USING (is_internal_user(auth.uid()));

-- Note: No INSERT/UPDATE/DELETE policies for internal users on invoices
-- Internal users can only view invoices, not modify them

COMMIT;

