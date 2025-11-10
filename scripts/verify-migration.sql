-- Verification queries to run after applying the migration
-- Run these in Supabase Dashboard → SQL Editor to verify the migration

-- 1. Check if schema_version column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'app_versions'
  AND column_name IN ('schema_version', 'rollback_sql')
ORDER BY column_name;

-- 2. Check if index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'app_versions'
  AND indexname = 'idx_app_versions_schema_version';

-- 3. Test get_current_app_version() returns schema_version
SELECT get_current_app_version();

-- 4. Check current app_versions table structure
SELECT version, release_notes, schema_version, rollback_sql, is_current, released_at
FROM app_versions
WHERE is_current = true
ORDER BY released_at DESC
LIMIT 1;

-- 5. Test update_app_version() with schema_version parameter
-- (This will update the version, so be careful in production)
-- Uncomment to test:
-- SELECT update_app_version(
--   '1.0.0',  -- App version
--   'Test schema version update',  -- Release notes
--   '1.0.0',  -- Schema version
--   NULL  -- Rollback SQL (optional)
-- );

-- 6. Verify function signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_current_app_version', 'update_app_version')
ORDER BY p.proname;

