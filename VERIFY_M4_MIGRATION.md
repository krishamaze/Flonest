# M4 Migration Verification Guide

## ✅ Migrations Applied

The following migrations have been successfully applied to Supabase:

1. ✅ `20251106161000_create_master_customers.sql` - Master customers table
2. ✅ `20251106161100_create_org_customers.sql` - Org-scoped customers table
3. ✅ `20251106161200_rpc_upsert_master_customer.sql` - RPC function for customer upsert
4. ✅ `20251106161300_alter_invoices_add_customer_link.sql` - Added customer_id to invoices

## 🔍 Verification Steps

### Option 1: Run SQL Verification Script (Recommended)

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `scripts/verify-m4-migration.sql`
4. Run the query
5. Review the results - all checks should show ✅

### Option 2: Manual Verification

#### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('master_customers', 'customers');
```

Expected: Both `master_customers` and `customers` should appear.

#### Check Unique Indexes
```sql
-- Master customers unique indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'master_customers' 
  AND (indexname LIKE '%mobile%' OR indexname LIKE '%gstin%');

-- Customers unique index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'customers' 
  AND indexname LIKE '%org_master%';
```

Expected:
- `idx_master_customers_mobile` (UNIQUE, partial WHERE mobile IS NOT NULL)
- `idx_master_customers_gstin` (UNIQUE, partial WHERE gstin IS NOT NULL)
- `idx_customers_org_master` (UNIQUE on org_id, master_customer_id)

#### Check RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('master_customers', 'customers');
```

Expected: `rowsecurity = true` for both tables.

#### Check RLS Policies
```sql
-- Master customers policies (should be read-only)
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'master_customers';

-- Customers policies (should be org-scoped)
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'customers';
```

Expected:
- `master_customers_read` policy with `cmd = 'SELECT'`
- `customers_org_isolation` policy with `cmd = 'ALL'` and qual containing `current_user_org_id()`

#### Check RPC Function
```sql
SELECT routine_name, security_type 
FROM information_schema.routines 
WHERE routine_name = 'upsert_master_customer';
```

Expected: Function exists with `security_type = 'DEFINER'`

#### Check invoices.customer_id
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name = 'customer_id';
```

Expected: Column exists, type `uuid`, nullable.

#### Check invoices.customer_id Index
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'invoices' 
  AND indexname LIKE '%customer%';
```

Expected: `idx_invoices_customer` index exists.

## ✅ Expected Results Summary

| Check | Expected Result |
|-------|----------------|
| Tables | `master_customers` and `customers` exist |
| Unique Indexes | 3 unique indexes (mobile, gstin, org_master) |
| RLS Enabled | Both tables have RLS enabled |
| RLS Policies | Read-only for master, org-scoped for customers |
| RPC Function | `upsert_master_customer` exists with SECURITY DEFINER |
| invoices.customer_id | Column exists and is indexed |

## 🧪 Test Unique Constraint

To verify unique constraints work:

```sql
-- This should succeed
INSERT INTO master_customers (mobile, legal_name)
VALUES ('9876543210', 'Test Customer');

-- This should fail with unique violation
INSERT INTO master_customers (mobile, legal_name)
VALUES ('9876543210', 'Duplicate Customer');
```

Expected: First insert succeeds, second fails with error code `23505` (unique_violation).

## 🧪 Test RLS

To verify RLS works:

1. **Master customers (read-only)**: Try to INSERT directly - should fail
2. **Customers (org-scoped)**: Users should only see customers from their org

## 📝 Notes

- Unique indexes use partial indexes (`WHERE mobile IS NOT NULL`) for better performance
- RLS on `master_customers` prevents direct writes (must use RPC function)
- RLS on `customers` uses `current_user_org_id()` for optimized org isolation
- The RPC function `upsert_master_customer` has `SECURITY DEFINER` to allow writes to read-only master table

