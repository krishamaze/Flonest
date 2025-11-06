-- M4 Migration Verification Script
-- Run this in Supabase SQL Editor to verify unique indexes and RLS

-- ============================================
-- 1. VERIFY TABLES EXIST
-- ============================================
SELECT 
    'Tables Check' as check_type,
    table_name,
    CASE 
        WHEN table_name IN ('master_customers', 'customers') THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('master_customers', 'customers')
ORDER BY table_name;

-- ============================================
-- 2. VERIFY UNIQUE INDEXES ON master_customers
-- ============================================
SELECT 
    'Unique Indexes - master_customers' as check_type,
    indexname,
    indexdef,
    CASE 
        WHEN indexname LIKE '%mobile%' OR indexname LIKE '%gstin%' THEN '✅ UNIQUE INDEX'
        ELSE '⚠️ OTHER INDEX'
    END as status
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'master_customers'
    AND (indexname LIKE '%mobile%' OR indexname LIKE '%gstin%' OR indexname LIKE '%unique%')
ORDER BY indexname;

-- ============================================
-- 3. VERIFY UNIQUE INDEXES ON customers
-- ============================================
SELECT 
    'Unique Indexes - customers' as check_type,
    indexname,
    indexdef,
    CASE 
        WHEN indexname LIKE '%org_master%' OR indexname LIKE '%unique%' THEN '✅ UNIQUE INDEX'
        ELSE '⚠️ OTHER INDEX'
    END as status
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'customers'
    AND (indexname LIKE '%org_master%' OR indexname LIKE '%unique%')
ORDER BY indexname;

-- ============================================
-- 4. VERIFY RLS IS ENABLED
-- ============================================
SELECT 
    'RLS Status' as check_type,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('master_customers', 'customers')
ORDER BY tablename;

-- ============================================
-- 5. VERIFY RLS POLICIES ON master_customers
-- ============================================
SELECT 
    'RLS Policies - master_customers' as check_type,
    policyname,
    cmd as command,
    CASE 
        WHEN cmd = 'SELECT' THEN '✅ READ POLICY'
        WHEN cmd = 'ALL' THEN '⚠️ ALL COMMANDS'
        ELSE '⚠️ OTHER'
    END as status,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'master_customers'
ORDER BY policyname;

-- ============================================
-- 6. VERIFY RLS POLICIES ON customers
-- ============================================
SELECT 
    'RLS Policies - customers' as check_type,
    policyname,
    cmd as command,
    CASE 
        WHEN cmd = 'ALL' AND qual LIKE '%current_user_org_id%' THEN '✅ ORG ISOLATION POLICY'
        ELSE '⚠️ CHECK MANUALLY'
    END as status,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'customers'
ORDER BY policyname;

-- ============================================
-- 7. VERIFY RPC FUNCTION EXISTS
-- ============================================
SELECT 
    'RPC Function' as check_type,
    routine_name,
    routine_type,
    security_type,
    CASE 
        WHEN routine_name = 'upsert_master_customer' AND security_type = 'DEFINER' THEN '✅ EXISTS (SECURITY DEFINER)'
        WHEN routine_name = 'upsert_master_customer' THEN '⚠️ EXISTS (WRONG SECURITY TYPE)'
        ELSE '❌ MISSING'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'upsert_master_customer';

-- ============================================
-- 8. VERIFY customer_id COLUMN IN invoices
-- ============================================
SELECT 
    'Invoices Column' as check_type,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name = 'customer_id' THEN '✅ COLUMN EXISTS'
        ELSE '❌ COLUMN MISSING'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'invoices'
    AND column_name = 'customer_id';

-- ============================================
-- 9. VERIFY INDEX ON invoices.customer_id
-- ============================================
SELECT 
    'Index - invoices.customer_id' as check_type,
    indexname,
    indexdef,
    CASE 
        WHEN indexname LIKE '%customer%' THEN '✅ INDEX EXISTS'
        ELSE '❌ INDEX MISSING'
    END as status
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'invoices'
    AND indexname LIKE '%customer%';

-- ============================================
-- 10. TEST UNIQUE CONSTRAINT (Try duplicate insert)
-- ============================================
-- This will fail if unique constraint works (expected behavior)
DO $$
DECLARE
    test_mobile TEXT := '9999999999';
    test_id UUID;
BEGIN
    -- Try to insert first record
    INSERT INTO master_customers (mobile, legal_name)
    VALUES (test_mobile, 'Test Customer 1')
    RETURNING id INTO test_id;
    
    RAISE NOTICE '✅ First insert succeeded (ID: %)', test_id;
    
    -- Try to insert duplicate (should fail)
    BEGIN
        INSERT INTO master_customers (mobile, legal_name)
        VALUES (test_mobile, 'Test Customer 2');
        
        RAISE WARNING '❌ Duplicate insert succeeded - UNIQUE CONSTRAINT NOT WORKING!';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✅ Duplicate insert prevented - UNIQUE CONSTRAINT WORKING!';
    END;
    
    -- Clean up
    DELETE FROM master_customers WHERE id = test_id;
    RAISE NOTICE '✅ Test record cleaned up';
END $$;

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
    'SUMMARY' as check_type,
    'All checks completed' as status,
    'Review results above' as notes;
