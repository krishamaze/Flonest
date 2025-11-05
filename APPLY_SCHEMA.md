# Apply Database Schema to Supabase

## 🎯 Quick Guide: Apply Schema to Your Supabase Database

Your database schema is ready in `schema.sql`. Follow these steps to apply it to your Supabase project.

---

## Method 1: Supabase Dashboard SQL Editor (Recommended)

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: **yzrwkznkfisfpnwzbwfw**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Paste Schema

1. Open `schema.sql` in your editor
2. Copy the entire contents (all 139 lines)
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify Tables Created

After running, you should see:
```
Success. No rows returned
```

Then verify by clicking **Table Editor** in the left sidebar. You should see:
- ✅ `tenants`
- ✅ `team_members`
- ✅ `master_products`
- ✅ `inventory`
- ✅ `invoices`
- ✅ `invoice_items`

---

## Method 2: Using Supabase CLI (Alternative)

If you prefer using the CLI:

```bash
# Link to your remote project
.\bin\supabase.exe link --project-ref yzrwkznkfisfpnwzbwfw

# Apply the schema
.\bin\supabase.exe db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres"
```

**Note:** You'll need your database password from Supabase Dashboard → Settings → Database

---

## 📋 What the Schema Creates

### Tables

1. **`tenants`** - Multi-tenant core
   - Stores business/organization information
   - GST configuration for Indian tax compliance
   - State information for tax calculation

2. **`team_members`** - User access control
   - Links auth.users to tenants
   - Role-based access (owner, staff, viewer)
   - Multi-tenant user management

3. **`master_products`** - Product catalog
   - Centralized product database
   - SKU management
   - Price controls (base price, min selling price)
   - Status workflow (pending, active, inactive)

4. **`inventory`** - Tenant-specific inventory
   - Per-tenant product stock
   - Cost price and selling price tracking
   - Quantity management

5. **`invoices`** - Sales invoices
   - Invoice generation
   - GST calculation (CGST, SGST)
   - Status tracking (draft, finalized, cancelled)

6. **`invoice_items`** - Invoice line items
   - Product-level invoice details
   - Quantity and pricing per item

### Security Features

✅ **Row Level Security (RLS)** enabled on all tables  
✅ **Tenant isolation** - Users can only see their own tenant's data  
✅ **Helper functions** for tenant context  
✅ **Indexes** for performance optimization  

### Helper Functions

- `current_user_tenant_id()` - Get current user's tenant ID
- `current_user_is_admin()` - Check if user is tenant owner

---

## 🧪 Test the Schema

After applying, test with some sample data:

### 1. Create a Test Tenant

```sql
INSERT INTO tenants (name, slug, state, gst_enabled)
VALUES ('Test Business', 'test-business', 'Maharashtra', true)
RETURNING *;
```

### 2. Link Your User to the Tenant

```sql
-- Get your user ID first
SELECT id, email FROM auth.users;

-- Then create team member (replace USER_ID and TENANT_ID)
INSERT INTO team_members (tenant_id, user_id, email, role)
VALUES (
  'TENANT_ID_FROM_STEP_1',
  'YOUR_USER_ID',
  'your-email@example.com',
  'owner'
);
```

### 3. Create a Test Product

```sql
INSERT INTO master_products (sku, name, base_price, min_selling_price, status)
VALUES ('TEST-001', 'Test Product', 100.00, 120.00, 'active')
RETURNING *;
```

### 4. Add to Inventory

```sql
-- Replace TENANT_ID and PRODUCT_ID
INSERT INTO inventory (tenant_id, product_id, quantity, cost_price, selling_price)
VALUES (
  'YOUR_TENANT_ID',
  'PRODUCT_ID_FROM_STEP_3',
  50,
  100.00,
  150.00
);
```

---

## 🔍 Verify RLS is Working

Test that Row Level Security is properly isolating tenant data:

```sql
-- This should only return YOUR tenant's data
SELECT * FROM inventory;

-- This should only return YOUR tenant
SELECT * FROM tenants;
```

If you see data from other tenants, RLS is not working correctly.

---

## ⚠️ Important Notes

### Before Applying Schema

1. **Backup existing data** (if any) from Supabase Dashboard → Database → Backups
2. **Check for conflicts** - If you have existing tables with the same names, you may need to drop them first
3. **Review the schema** - Make sure it matches your requirements

### After Applying Schema

1. **Verify all tables created** - Check Table Editor
2. **Test RLS policies** - Try querying data
3. **Create initial tenant** - Set up your first business
4. **Link your user** - Add yourself to team_members

---

## 🐛 Troubleshooting

### Error: "relation already exists"

If tables already exist:

```sql
-- Drop existing tables (WARNING: This deletes all data!)
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS master_products CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Then run schema.sql again
```

### Error: "extension uuid-ossp does not exist"

The extension should be available by default. If not:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### RLS Policies Not Working

Make sure you're authenticated when testing:

1. Go to Authentication → Users in Supabase Dashboard
2. Create a test user if needed
3. Use that user's ID in team_members table

---

## 📊 Schema Diagram

```
┌─────────────┐
│   tenants   │
└──────┬──────┘
       │
       ├──────────────────┐
       │                  │
┌──────▼──────┐    ┌──────▼──────────┐
│team_members │    │   inventory     │
└─────────────┘    └──────┬──────────┘
                          │
                   ┌──────▼──────────┐
                   │master_products  │
                   └──────┬──────────┘
                          │
                   ┌──────▼──────────┐
                   │   invoices      │
                   └──────┬──────────┘
                          │
                   ┌──────▼──────────┐
                   │ invoice_items   │
                   └─────────────────┘
```

---

## ✅ Next Steps After Schema Applied

1. **Update Environment Variables** (if you rotated Supabase keys)
2. **Create your first tenant** using the test SQL above
3. **Link your user account** to the tenant
4. **Test the app** at https://biz-finetune-store.vercel.app/
5. **Add sample products** to test inventory management

---

## 🚀 Ready to Go!

Once the schema is applied and you've created a tenant + linked your user, your app will be fully functional!

The app will automatically:
- ✅ Enforce tenant isolation via RLS
- ✅ Show only your tenant's data
- ✅ Allow product and inventory management
- ✅ Support invoice generation with GST

