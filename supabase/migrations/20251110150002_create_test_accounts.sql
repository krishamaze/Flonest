-- Migration: Create test accounts for platform admin dashboard testing
-- Creates test platform admin and org owner accounts with sample data

BEGIN;

-- Note: This migration assumes auth users are created via Supabase Auth
-- You'll need to create the auth users manually via Supabase Dashboard or Auth API
-- This migration only creates the profiles and sample data

-- Test Platform Admin Account
-- Auth user should be created with email: platform-admin@test.com
-- After creating auth user, get the user ID and update the profile:
DO $$
DECLARE
  v_platform_admin_user_id uuid;
  v_owner_user_id uuid;
  v_test_org_id uuid;
  v_pending_product_id uuid;
BEGIN
  -- Check if test platform admin profile exists (by email lookup)
  SELECT id INTO v_platform_admin_user_id
  FROM profiles
  WHERE email = 'platform-admin@test.com'
  LIMIT 1;

  -- If platform admin profile doesn't exist, we'll need to create it after auth user is created
  -- For now, we'll create a placeholder that will be updated manually
  -- The auth user must be created first via Supabase Auth

  -- Test Org Owner Account
  -- Auth user should be created with email: owner@test.com
  SELECT id INTO v_owner_user_id
  FROM profiles
  WHERE email = 'owner@test.com'
  LIMIT 1;

  -- Create test org if it doesn't exist
  IF v_owner_user_id IS NOT NULL THEN
    SELECT id INTO v_test_org_id
    FROM orgs
    WHERE slug = 'test-org-owner'
    LIMIT 1;

    IF v_test_org_id IS NULL THEN
      INSERT INTO orgs (name, slug, state, gst_enabled)
      VALUES ('Test Org', 'test-org-owner', 'Maharashtra', false)
      RETURNING id INTO v_test_org_id;
    END IF;

    -- Ensure membership exists
    IF NOT EXISTS (
      SELECT 1 FROM memberships
      WHERE profile_id = v_owner_user_id AND org_id = v_test_org_id
    ) THEN
      INSERT INTO memberships (profile_id, org_id, role)
      VALUES (v_owner_user_id, v_test_org_id, 'owner');
    END IF;

    -- Create sample pending products for testing
    IF NOT EXISTS (
      SELECT 1 FROM master_products
      WHERE sku = 'TEST-PRODUCT-001'
    ) THEN
      INSERT INTO master_products (
        sku,
        name,
        category,
        base_unit,
        base_price,
        status,
        approval_status,
        created_by,
        submitted_org_id
      )
      VALUES (
        'TEST-PRODUCT-001',
        'Test Product 1',
        'Electronics',
        'pcs',
        1000.00,
        'active',
        'pending',
        v_owner_user_id,
        v_test_org_id
      )
      RETURNING id INTO v_pending_product_id;

      -- Create review entry
      INSERT INTO master_product_reviews (
        master_product_id,
        action,
        reviewed_by,
        reviewed_at,
        note,
        previous_approval_status,
        new_approval_status
      )
      VALUES (
        v_pending_product_id,
        'submitted',
        NULL,
        NOW(),
        'Test product submitted for review',
        NULL,
        'pending'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM master_products
      WHERE sku = 'TEST-PRODUCT-002'
    ) THEN
      INSERT INTO master_products (
        sku,
        name,
        category,
        base_unit,
        base_price,
        status,
        approval_status,
        created_by,
        submitted_org_id
      )
      VALUES (
        'TEST-PRODUCT-002',
        'Test Product 2 (No HSN)',
        'Electronics',
        'pcs',
        2000.00,
        'active',
        'pending',
        v_owner_user_id,
        v_test_org_id
      );
    END IF;
  END IF;

  -- Create sample HSN codes for testing (if they don't exist)
  INSERT INTO hsn_master (hsn_code, description, gst_rate, category, is_active)
  VALUES
    ('8471', 'Automatic data processing machines', 18.00, 'Electronics', true),
    ('8517', 'Telephone sets, including telephones for cellular networks', 18.00, 'Electronics', true),
    ('8528', 'Monitors and projectors', 18.00, 'Electronics', true)
  ON CONFLICT (hsn_code) DO NOTHING;

END $$;

-- Instructions comment
COMMENT ON TABLE profiles IS 'Test accounts setup:
1. Create auth user for platform-admin@test.com via Supabase Auth
2. Create auth user for owner@test.com via Supabase Auth
3. Update profiles.platform_admin = true for platform-admin@test.com
4. Run this migration to create profiles, orgs, and sample data
5. Test passwords should be set via Supabase Auth (recommended: "Test123!@#")';

COMMIT;

