-- Fix infinite recursion in memberships RLS policy
-- The policy was querying memberships to check access, causing recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Memberships: Users can view memberships in their orgs" ON memberships;
DROP POLICY IF EXISTS "Memberships: Owners can manage memberships" ON memberships;

-- Create a policy that allows users to see their own membership directly
-- This avoids recursion by checking profile_id directly
CREATE POLICY "Memberships: Users can view own membership" ON memberships
    FOR SELECT USING (
        profile_id IN (
            SELECT id FROM profiles WHERE id = auth.uid()
        )
    );

-- Create a policy that allows users to see memberships in their orgs
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Memberships: Users can view org memberships" ON memberships
    FOR SELECT USING (
        org_id = current_user_org_id()
    );

-- Allow users to INSERT their own membership (for initial setup)
CREATE POLICY "Memberships: Users can insert own membership" ON memberships
    FOR INSERT WITH CHECK (
        profile_id IN (
            SELECT id FROM profiles WHERE id = auth.uid()
        )
    );

-- Owners can UPDATE/DELETE memberships in their org
-- Use SECURITY DEFINER function to avoid recursion
CREATE POLICY "Memberships: Owners can manage org memberships" ON memberships
    FOR UPDATE USING (
        org_id = current_user_org_id() AND
        EXISTS (
            SELECT 1 FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid() 
              AND m.org_id = current_user_org_id()
              AND m.role = 'owner'
        )
    );

CREATE POLICY "Memberships: Owners can delete org memberships" ON memberships
    FOR DELETE USING (
        org_id = current_user_org_id() AND
        EXISTS (
            SELECT 1 FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid() 
              AND m.org_id = current_user_org_id()
              AND m.role = 'owner'
        )
    );

