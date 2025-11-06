# M3 Enhanced Features - Deployment & Testing Guide

## 🚀 Deployment Steps

### Step 1: Database Migration (REQUIRED FIRST)

The migration adds `ean` and `unit` fields to the `products` table.

**Option A: Using Supabase CLI (Recommended)**

1. Run the migration command:
   ```powershell
   .\bin\supabase.exe db push
   ```

2. When prompted, type `Y` and press Enter to confirm.

3. Verify the migration succeeded - you should see:
   ```
   ✓ Migration applied successfully
   ```

**Option B: Manual via Supabase Dashboard**

1. Go to: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/sql/new

2. Open the migration file: `supabase/migrations/20251106030000_add_ean_unit_to_products.sql`

3. Copy the entire contents and paste into the SQL Editor

4. Click "Run" to execute

5. Verify success message appears

**Verification Query:**
```sql
-- Check that EAN and unit columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('ean', 'unit');
```

Expected result: Should show 2 rows with `ean` (text, null) and `unit` (text, 'pcs').

---

### Step 2: Code Deployment

**Option A: Using Vercel CLI**

```powershell
vercel --prod
```

**Option B: Using Git Push (Auto-deploys via Vercel)**

```powershell
git add .
git commit -m "M3: Add EAN/unit fields, pagination, stock calculations"
git push origin main
```

Vercel will automatically deploy when you push to the `main` branch.

---

## ✅ Testing Checklist

### 1. Database Verification

Run in Supabase SQL Editor:

```sql
-- Verify EAN and unit columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('ean', 'unit');

-- Verify EAN index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'products'
AND indexname = 'idx_products_org_ean';
```

### 2. Application Testing

**Access Production:**
- URL: https://biz-finetune-store.vercel.app
- Login: demo@example.com

**ProductList Component Tests:**
- [ ] Search bar works (try searching by name, SKU, or EAN)
- [ ] Category filter buttons appear and work
- [ ] Pagination controls appear when > 20 products
- [ ] Current stock displays for each product
- [ ] Stock status badges show correctly (In Stock/Low Stock/Out of Stock)
- [ ] Products load quickly (< 2 seconds)

**ProductForm Component Tests:**
- [ ] Click "Add Product" - form opens
- [ ] EAN field appears (optional)
- [ ] Unit field appears (default: "pcs")
- [ ] Can create product with EAN: "1234567890123"
- [ ] Can create product with unit: "kg"
- [ ] Can edit existing product and update EAN/unit
- [ ] Form validation works (required fields)
- [ ] Form resets after successful submission

**StockTransaction Component Tests:**
- [ ] Navigate to Inventory page
- [ ] Click "Add Transaction"
- [ ] Select a product - current stock displays
- [ ] Change transaction type - stock preview updates
- [ ] Enter quantity - stock after transaction preview shows
- [ ] Try stock-out with quantity > current stock - validation error appears
- [ ] Create stock-in transaction - stock increases
- [ ] Create stock-out transaction - stock decreases
- [ ] Low stock warning appears when stock < min_stock_level

**Mobile Testing:**
- [ ] Open on mobile device
- [ ] Forms open as Drawer (not Modal)
- [ ] Search works on mobile
- [ ] Pagination works on mobile
- [ ] Touch interactions are smooth
- [ ] Stock transaction form displays correctly

### 3. Performance Checks

- [ ] Product list loads in < 2 seconds
- [ ] Search is responsive (300ms debounce)
- [ ] Pagination loads quickly
- [ ] Stock calculations are fast
- [ ] No console errors in browser DevTools

### 4. Data Integrity Checks

- [ ] Products are org-scoped (can't see other org's products)
- [ ] Stock transactions are org-scoped
- [ ] Stock calculations are accurate
- [ ] EAN field is searchable
- [ ] Unit field displays correctly in product list

---

## 🔍 Quick Test Script

Run the verification script:

```powershell
node scripts/verify-production.cjs
```

This will provide a checklist and verification queries.

---

## 🐛 Troubleshooting

### Migration Fails

**Error: "column already exists"**
- The migration uses `IF NOT EXISTS`, so this is safe to ignore
- Or manually check if columns exist first

**Error: "permission denied"**
- Ensure you're linked to the correct project
- Check Supabase project permissions

### Code Deployment Fails

**Build errors:**
- Run `npm run build` locally first to check for errors
- Ensure all TypeScript types are correct

**Vercel deployment fails:**
- Check Vercel dashboard for error logs
- Verify environment variables are set

### Features Not Working

**Search not working:**
- Check browser console for errors
- Verify database migration was applied
- Check that products have data

**Stock not displaying:**
- Verify stock_ledger table has data
- Check browser console for API errors
- Verify RLS policies allow access

---

## 📝 Post-Deployment Notes

After successful deployment:

1. ✅ Database migration applied
2. ✅ Code deployed to Vercel
3. ✅ All features tested and working
4. ✅ Mobile experience verified
5. ✅ Performance acceptable

**Production URL:** https://biz-finetune-store.vercel.app

**Next Steps:**
- Monitor error logs in Vercel
- Check Supabase logs for any RLS issues
- Gather user feedback on new features

