-- SQL Script to Create Internal User Account
-- This script creates an internal user account using SQL
-- Requires: Database connection (transaction pooler or direct connection)
-- 
-- Usage:
-- 1. Get user ID from auth.users (if user already exists)
-- 2. Create/update profile with is_internal = true
-- 3. Verify setup
--
-- Note: User must be created in Supabase Auth first via Dashboard or Auth API
-- This script only handles the profile setup

-- Step 1: Create or get auth user
-- Note: Auth users must be created via Supabase Dashboard → Authentication → Users
-- Or via Supabase Auth API
-- This script assumes the user already exists in auth.users
-- Default password: password

-- Step 2: Create or update profile with is_internal = true
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'internal@test.com'; -- Change this to your desired email
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User % not found in auth.users. Please create the user first via Supabase Dashboard → Authentication → Users', v_email;
  END IF;

  -- Create or update profile with is_internal = true
  INSERT INTO profiles (id, email, full_name, is_internal)
  VALUES (v_user_id, v_email, 'Internal Test User', true)
  ON CONFLICT (id) DO UPDATE
  SET 
    is_internal = true,
    email = v_email,
    full_name = COALESCE(profiles.full_name, 'Internal Test User');

  RAISE NOTICE '✅ Internal user profile created/updated for: % (User ID: %)', v_email, v_user_id;

  -- Verify is_internal flag
  IF (SELECT is_internal FROM profiles WHERE id = v_user_id) THEN
    RAISE NOTICE '✅ Verified: is_internal = true';
  ELSE
    RAISE EXCEPTION '❌ Failed to set is_internal flag';
  END IF;

  -- Test is_internal_user function
  IF (SELECT is_internal_user(v_user_id)) THEN
    RAISE NOTICE '✅ Verified: is_internal_user() returns true';
  ELSE
    RAISE EXCEPTION '❌ is_internal_user() function test failed';
  END IF;

END $$;

-- Step 3: Verify the setup
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.is_internal,
  is_internal_user(p.id) as function_test,
  CASE 
    WHEN p.is_internal THEN '✅ Internal User'
    ELSE '❌ Not Internal'
  END as status
FROM profiles p
WHERE p.email = 'internal@test.com'; -- Change this to match your email

-- Step 4: Display summary
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'internal@test.com';
BEGIN
  SELECT id INTO v_user_id
  FROM profiles
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ Internal User Account Setup Complete!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Email: %', v_email;
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'is_internal: true';
    RAISE NOTICE '';
    RAISE NOTICE 'Access:';
    RAISE NOTICE '  - Can access /reviewer dashboard';
    RAISE NOTICE '  - Can review products';
    RAISE NOTICE '  - Can manage HSN codes';
    RAISE NOTICE '  - Can view blocked invoices';
    RAISE NOTICE '  - Can access all internal features';
    RAISE NOTICE '============================================================';
  END IF;
END $$;

