-- Set krishamaz@gmail.com as platform admin
-- Run this in Supabase Dashboard → SQL Editor after the user exists in auth.users

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'krishamaz@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User krishamaz@gmail.com not found in auth.users. Please create the user first via Supabase Dashboard → Authentication → Users or sign up via the app.';
  END IF;

  -- Create or update profile with platform_admin = true
  INSERT INTO profiles (id, email, full_name, platform_admin)
  VALUES (
    v_user_id,
    'krishamaz@gmail.com',
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id), 'Platform Admin'),
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    platform_admin = true,
    email = 'krishamaz@gmail.com',
    updated_at = NOW();

  RAISE NOTICE 'Platform admin access granted to krishamaz@gmail.com (user_id: %)', v_user_id;
END $$;

-- Verify the update
SELECT 
  id,
  email,
  full_name,
  platform_admin,
  created_at
FROM profiles
WHERE email = 'krishamaz@gmail.com';

