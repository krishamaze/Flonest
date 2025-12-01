-- Fix infinite recursion in memberships RLS policies
-- Root cause: Policies on memberships reference orgs, and policies on orgs reference memberships

BEGIN;

-- Drop the recursive policies on memberships that cause the issue
DROP POLICY IF EXISTS "Memberships: Users can view memberships in their orgs" ON memberships;
DROP POLICY IF EXISTS "Memberships: Owners can manage memberships" ON memberships;

-- Keep only the simple, non-recursive policy for reading own memberships
-- This policy is already in place: "Users can read own memberships"
-- It uses: profile_id = auth.uid() which doesn't recurse

-- For orgs table, ensure we have a simple policy that doesn't call current_user_org_id()
-- Drop the problematic policy that uses current_user_org_id()
DROP POLICY IF EXISTS "orgs_view_own" ON orgs;

-- The policy "orgs_members_read_direct" should handle this without recursion:
-- It directly checks: id IN (SELECT org_id FROM memberships WHERE profile_id = auth.uid() AND membership_status = 'active')

COMMIT;
