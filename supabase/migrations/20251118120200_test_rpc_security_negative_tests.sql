-- Security Verification: Negative Testing for RPC Tenant Isolation
-- This migration documents and verifies that RPC functions properly reject unauthorized requests
--
-- IMPORTANT: These tests must be run while authenticated as a user with a valid org_id
-- The tests verify that:
-- 1. Functions reject NULL org_id
-- 2. Functions reject foreign org_id (org_id that doesn't match current_user_org_id())
-- 3. Functions accept valid org_id (org_id that matches current_user_org_id())
--
-- To run these tests manually:
-- 1. Authenticate as a user with a valid org_id
-- 2. Execute each test case below
-- 3. Verify that unauthorized requests raise exceptions

BEGIN;

-- =====================================================
-- Test Helper: Create a test function to verify security
-- =====================================================

-- This function can be called to test RPC security
-- It requires being authenticated as a user
CREATE OR REPLACE FUNCTION public.test_rpc_security()
RETURNS TABLE (
  test_name text,
  passed boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
  v_foreign_org_id uuid;
  v_test_result record;
  v_error_text text;
BEGIN
  -- Get current user's org_id
  v_user_org_id := public.current_user_org_id();
  
  IF v_user_org_id IS NULL THEN
    RETURN QUERY SELECT 'setup_check'::text, false, 'User is not a member of any organization. Cannot run tests.'::text;
    RETURN;
  END IF;
  
  -- Get a foreign org_id (any org that's not the user's org)
  SELECT id INTO v_foreign_org_id
  FROM orgs
  WHERE id != v_user_org_id
  LIMIT 1;
  
  -- Test 1: lookup_serial_number with NULL org_id
  BEGIN
    PERFORM * FROM public.lookup_serial_number(NULL::uuid, 'TEST123');
    RETURN QUERY SELECT 'lookup_serial_number_null_org_id'::text, false, 'Should have raised exception but did not'::text;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%org_id parameter must match%' OR SQLERRM LIKE '%not a member%' THEN
        RETURN QUERY SELECT 'lookup_serial_number_null_org_id'::text, true, NULL::text;
      ELSE
        RETURN QUERY SELECT 'lookup_serial_number_null_org_id'::text, false, SQLERRM::text;
      END IF;
  END;
  
  -- Test 2: lookup_serial_number with foreign org_id
  IF v_foreign_org_id IS NOT NULL THEN
    BEGIN
      PERFORM * FROM public.lookup_serial_number(v_foreign_org_id, 'TEST123');
      RETURN QUERY SELECT 'lookup_serial_number_foreign_org_id'::text, false, 'Should have raised exception but did not'::text;
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%org_id parameter must match%' THEN
          RETURN QUERY SELECT 'lookup_serial_number_foreign_org_id'::text, true, NULL::text;
        ELSE
          RETURN QUERY SELECT 'lookup_serial_number_foreign_org_id'::text, false, SQLERRM::text;
        END IF;
    END;
  ELSE
    RETURN QUERY SELECT 'lookup_serial_number_foreign_org_id'::text, false, 'No foreign org_id available for testing'::text;
  END IF;
  
  -- Test 3: lookup_serial_number with valid org_id (should succeed or return not found, not raise exception)
  BEGIN
    PERFORM * FROM public.lookup_serial_number(v_user_org_id, 'NONEXISTENT_SERIAL_12345');
    RETURN QUERY SELECT 'lookup_serial_number_valid_org_id'::text, true, NULL::text;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%org_id parameter must match%' OR SQLERRM LIKE '%not a member%' THEN
        RETURN QUERY SELECT 'lookup_serial_number_valid_org_id'::text, false, 'Should not raise org_id exception for valid org_id'::text;
      ELSE
        RETURN QUERY SELECT 'lookup_serial_number_valid_org_id'::text, false, SQLERRM::text;
      END IF;
  END;
  
  -- Test 4: lookup_product_code with NULL org_id
  BEGIN
    PERFORM * FROM public.lookup_product_code(NULL::uuid, 'TEST123');
    RETURN QUERY SELECT 'lookup_product_code_null_org_id'::text, false, 'Should have raised exception but did not'::text;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%org_id parameter must match%' OR SQLERRM LIKE '%not a member%' THEN
        RETURN QUERY SELECT 'lookup_product_code_null_org_id'::text, true, NULL::text;
      ELSE
        RETURN QUERY SELECT 'lookup_product_code_null_org_id'::text, false, SQLERRM::text;
      END IF;
  END;
  
  -- Test 5: lookup_product_code with foreign org_id
  IF v_foreign_org_id IS NOT NULL THEN
    BEGIN
      PERFORM * FROM public.lookup_product_code(v_foreign_org_id, 'TEST123');
      RETURN QUERY SELECT 'lookup_product_code_foreign_org_id'::text, false, 'Should have raised exception but did not'::text;
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%org_id parameter must match%' THEN
          RETURN QUERY SELECT 'lookup_product_code_foreign_org_id'::text, true, NULL::text;
        ELSE
          RETURN QUERY SELECT 'lookup_product_code_foreign_org_id'::text, false, SQLERRM::text;
        END IF;
    END;
  ELSE
    RETURN QUERY SELECT 'lookup_product_code_foreign_org_id'::text, false, 'No foreign org_id available for testing'::text;
  END IF;
  
  -- Test 6: lookup_product_code with valid org_id (should succeed or return not found, not raise exception)
  BEGIN
    PERFORM * FROM public.lookup_product_code(v_user_org_id, 'NONEXISTENT_CODE_12345');
    RETURN QUERY SELECT 'lookup_product_code_valid_org_id'::text, true, NULL::text;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%org_id parameter must match%' OR SQLERRM LIKE '%not a member%' THEN
        RETURN QUERY SELECT 'lookup_product_code_valid_org_id'::text, false, 'Should not raise org_id exception for valid org_id'::text;
      ELSE
        RETURN QUERY SELECT 'lookup_product_code_valid_org_id'::text, false, SQLERRM::text;
      END IF;
  END;
  
  RETURN;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.test_rpc_security() TO authenticated;

-- =====================================================
-- Manual Test Cases (for reference)
-- =====================================================
-- 
-- These test cases should be run manually while authenticated:
--
-- 1. Test NULL org_id rejection:
--    SELECT * FROM lookup_serial_number(NULL, 'TEST123');
--    Expected: Exception "Access denied: org_id parameter must match current user organization"
--
-- 2. Test foreign org_id rejection:
--    SELECT * FROM lookup_serial_number('00000000-0000-0000-0000-000000000000'::uuid, 'TEST123');
--    Expected: Exception "Access denied: org_id parameter must match current user organization"
--
-- 3. Test valid org_id acceptance:
--    SELECT * FROM lookup_serial_number(current_user_org_id(), 'TEST123');
--    Expected: Returns result (found=false if serial doesn't exist, but no exception)
--
-- 4. Same tests for lookup_product_code:
--    SELECT * FROM lookup_product_code(NULL, 'TEST123');
--    SELECT * FROM lookup_product_code('00000000-0000-0000-0000-000000000000'::uuid, 'TEST123');
--    SELECT * FROM lookup_product_code(current_user_org_id(), 'TEST123');

COMMIT;



