# Schema Migration Guide

## ⚠️ Error: "relation 'tenants' already exists"

You're seeing this error because tables already exist in your Supabase database. You have **3 options**:

---

## Option 1: Safe Migration (Recommended if you have data)

Use this if you want to preserve any existing data and update the schema.

### Steps:

1. **Check what exists** - Run `check-existing-schema.sql` in Supabase SQL Editor
   - This shows all current tables, columns, and policies
   - Review the output to see what data you have

2. **Run migration** - Run `migrate-to-new-schema.sql` in Supabase SQL Editor
   - This will:
     - ✅ Keep existing `tenants`, `team_members`, etc. if they match
     - ✅ Update RLS policies to match new schema
     - ✅ Create missing tables
     - ✅ Add missing indexes
     - ⚠️ Drop old tables: `products`, `users`, `inventory_transactions`

3. **Verify** - Run `check-existing-schema.sql` again to confirm

---

## Option 2: Fresh Start (Recommended if no important data)

Use this if you have no important data and want to start completely fresh.

### Steps:

1. **Drop everything** - Run `drop-all-tables.sql` in Supabase SQL Editor
   - ⚠️ **WARNING: This deletes ALL data!**
   - Drops all tables, functions, and policies

2. **Create fresh schema** - Run `schema.sql` in Supabase SQL Editor
   - Creates all tables from scratch
   - Sets up RLS policies
   - Creates indexes

3. **Add initial data** - Run `setup-initial-data.sql`
   - Creates your first tenant
   - Links your user account
   - Adds sample products

---

## Option 3: Manual Check & Fix

Use this if you want full control over the migration.

### Step 1: Check what exists

Run in Supabase SQL Editor:

```sql
-- See all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Step 2: Compare schemas

**Old schema** (from docs/GETTING_STARTED.md):
- `tenants` - Basic tenant info (no GST fields)
- `users` - User profiles (separate from auth.users)
- `products` - Per-tenant products
- `inventory_transactions` - Stock movements

**New schema** (from schema.sql):
- `tenants` - Enhanced with GST fields
- `team_members` - Links auth.users to tenants
- `master_products` - Centralized product catalog
- `inventory` - Per-tenant stock levels
- `invoices` - Sales invoices with GST
- `invoice_items` - Invoice line items

### Step 3: Decide on migration path

**If schemas are similar:**
- Use `migrate-to-new-schema.sql`

**If schemas are completely different:**
- Use `drop-all-tables.sql` then `schema.sql`

---

## Quick Decision Tree

```
Do you have important data in the database?
│
├─ NO → Use Option 2 (Fresh Start)
│       1. Run drop-all-tables.sql
│       2. Run schema.sql
│       3. Run setup-initial-data.sql
│
└─ YES → Do the table structures match schema.sql?
         │
         ├─ YES → Use Option 1 (Safe Migration)
         │        1. Run check-existing-schema.sql
         │        2. Run migrate-to-new-schema.sql
         │
         └─ NO → Manual migration needed
                  1. Export your data
                  2. Run drop-all-tables.sql
                  3. Run schema.sql
                  4. Import your data
```

---

## Files Reference

| File | Purpose | Safe? |
|------|---------|-------|
| `check-existing-schema.sql` | View current database structure | ✅ Read-only |
| `migrate-to-new-schema.sql` | Update schema preserving data | ⚠️ Modifies DB |
| `drop-all-tables.sql` | Delete everything | ❌ Destructive |
| `schema.sql` | Create fresh schema | ✅ If DB empty |
| `setup-initial-data.sql` | Add test data | ✅ Inserts only |

---

## Recommended Approach for You

Since you're getting the "relation already exists" error, I recommend:

### 🎯 **Option 2: Fresh Start**

You likely don't have important production data yet, so:

1. **Copy and paste `drop-all-tables.sql`** into Supabase SQL Editor
2. Click **Run** - this deletes everything
3. **Copy and paste `schema.sql`** into Supabase SQL Editor  
4. Click **Run** - this creates the new schema
5. **Follow `APPLY_SCHEMA.md`** to create your first tenant

This gives you a clean slate with the correct schema.

---

## After Migration

Once the schema is applied:

1. ✅ **Verify tables** - Check Table Editor in Supabase Dashboard
2. ✅ **Create tenant** - Run the INSERT queries from `setup-initial-data.sql`
3. ✅ **Link your user** - Add yourself to `team_members`
4. ✅ **Test the app** - Visit https://biz-finetune-store.vercel.app/

---

## Need Help?

If you're unsure which option to choose:

1. Run `check-existing-schema.sql` first
2. Review the output
3. If you see tables like `products`, `users`, `inventory_transactions` → Use Option 2
4. If you see tables matching `schema.sql` → Schema is already applied!

---

## Troubleshooting

### Error: "permission denied"
- Make sure you're using the Supabase SQL Editor (not psql)
- You should be logged in as the project owner

### Error: "cannot drop table because other objects depend on it"
- Use `CASCADE` in the DROP statements (already included in scripts)

### Error: "function does not exist"
- This is normal if functions weren't created yet
- The migration script handles this

---

## Summary

**Fastest path to working app:**

```sql
-- Step 1: Drop everything (in Supabase SQL Editor)
-- Copy/paste drop-all-tables.sql and run

-- Step 2: Create schema (in Supabase SQL Editor)
-- Copy/paste schema.sql and run

-- Step 3: Create tenant (in Supabase SQL Editor)
INSERT INTO tenants (name, slug, state, gst_enabled)
VALUES ('My Business', 'my-business', 'Maharashtra', true)
RETURNING id;

-- Step 4: Link your user (replace IDs)
SELECT id, email FROM auth.users; -- Get your user ID
INSERT INTO team_members (tenant_id, user_id, email, role)
VALUES ('TENANT_ID', 'USER_ID', 'your@email.com', 'owner');

-- Done! Test at https://biz-finetune-store.vercel.app/
```

