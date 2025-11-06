-- Add INSERT policy for profiles table if it doesn't exist
-- This allows users to create their own profile when they first sign up

-- Drop policy if it exists (idempotent)
DROP POLICY IF EXISTS "Profiles: Users can insert own profile" ON profiles;

-- Create INSERT policy
CREATE POLICY "Profiles: Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

