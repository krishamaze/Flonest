-- Add RLS policy to allow org admins to update their organization settings

BEGIN;

-- Allow org admins (role = 'admin') to update their org
CREATE POLICY "Orgs: Admins can update their org" ON orgs
  FOR UPDATE 
  USING (
    id IN (
      SELECT m.org_id 
      FROM memberships m
      INNER JOIN profiles p ON p.id = m.profile_id
      WHERE p.id = auth.uid() 
        AND m.role IN ('admin', 'owner') -- Both admin and owner can update
    )
  );

COMMIT;

