-- Add INSERT policy for orgs table
-- Users need to be able to create their own org when they first sign up

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Orgs: Authenticated users can create orgs" ON orgs;

-- Allow authenticated users to INSERT orgs
-- Check that user is authenticated (has a valid auth.uid())
CREATE POLICY "Orgs: Authenticated users can create orgs" ON orgs
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

