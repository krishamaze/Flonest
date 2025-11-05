-- ⚠️ DANGER: This script drops ALL tables and starts fresh
-- ⚠️ WARNING: This will DELETE ALL DATA in your database!
-- ⚠️ Only run this if you want to completely reset your database

-- Use this if:
-- 1. You have no important data yet
-- 2. You want to start completely fresh
-- 3. The migration script doesn't work

-- DO NOT RUN THIS IN PRODUCTION!

BEGIN;

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS master_products CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop old tables from previous schema (if they exist)
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS current_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_is_admin() CASCADE;

COMMIT;

-- Now you can run schema.sql to create everything fresh
SELECT 'All tables dropped. You can now run schema.sql' as status;

