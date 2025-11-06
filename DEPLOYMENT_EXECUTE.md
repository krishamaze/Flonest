# M3 Production Deployment - Execution Guide

## Quick Deployment Commands

### Option 1: Automated (Recommended)

**Database Migration:**
```powershell
# This will prompt for confirmation
.\bin\supabase.exe db push
```

**Code Deployment:**
```powershell
# Deploy to production
vercel --prod
```

### Option 2: Manual via Dashboards

**Database Migration via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/sql/new
2. Copy contents of: `supabase/migrations/20251106020000_create_products_stock_ledger.sql`
3. Paste and click "Run"
4. Verify success message

**Code Deployment via Git:**
```powershell
git add .
git commit -m "M3: Deploy products and stock_ledger CRUD"
git push origin main
# Vercel will auto-deploy if connected
```

## Post-Deployment Verification

### 1. Database Verification

Run in Supabase SQL Editor:
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('products', 'stock_ledger');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'stock_ledger');

-- Check policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('products', 'stock_ledger');
```

### 2. Application Verification

**Access Production:**
- URL: https://biz-finetune-store.vercel.app
- Login: demo@example.com

**Test Checklist:**
- [ ] Login successful
- [ ] Products page loads
- [ ] Can create new product
- [ ] Can edit product
- [ ] Can delete product (soft delete)
- [ ] Stock ledger page loads
- [ ] Can create stock transaction
- [ ] Filters work on stock ledger
- [ ] Search works on products

### 3. Mobile Device Testing

**PWA Installation:**
1. Open https://biz-finetune-store.vercel.app on mobile browser
2. Tap browser menu → "Add to Home Screen"
3. Verify app icon appears
4. Open installed app

**Mobile Testing:**
- [ ] Forms open as drawer (not modal)
- [ ] Touch interactions work
- [ ] Stock transaction creation works
- [ ] Product CRUD works on mobile
- [ ] Offline functionality (if implemented)

### 4. Data Integrity Testing

**RLS Isolation Test:**
1. Create product in demo org
2. Verify product appears in list
3. (If you have access to another org) Verify product NOT visible in other org

**Stock Ledger Test:**
1. Create stock "in" transaction
2. Verify appears in ledger
3. Create stock "out" transaction
4. Verify both transactions visible
5. Test filter buttons (All, Stock In, Stock Out, Adjustment)

**SKU Uniqueness Test:**
1. Create product with SKU "TEST-001"
2. Try to create another product with same SKU
3. Should show error: "Product with SKU 'TEST-001' already exists"

## Rollback Procedures

### Database Rollback

If migration causes issues, run in Supabase SQL Editor:

```sql
BEGIN;

-- Drop policies
DROP POLICY IF EXISTS "products_tenant_isolation" ON products;
DROP POLICY IF EXISTS "stock_ledger_tenant_isolation" ON stock_ledger;

-- Drop indexes
DROP INDEX IF EXISTS idx_stock_ledger_created_at;
DROP INDEX IF EXISTS idx_stock_ledger_org_product;
DROP INDEX IF EXISTS idx_products_org_status;
DROP INDEX IF EXISTS idx_products_org_sku;

-- Drop tables (WARNING: This deletes all data)
DROP TABLE IF EXISTS stock_ledger CASCADE;
DROP TABLE IF EXISTS products CASCADE;

COMMIT;
```

### Code Rollback

**Via Vercel Dashboard:**
1. Go to: https://vercel.com/dashboard
2. Select project: biz-finetune-store
3. Go to "Deployments"
4. Find previous working deployment
5. Click "..." → "Promote to Production"

**Via Git:**
```powershell
git checkout <previous-commit-hash>
git push origin main --force
```

## Troubleshooting

### Migration Fails

**Error: "relation already exists"**
- Tables may already exist from previous attempt
- Check Supabase Dashboard → Table Editor
- If tables exist but incomplete, drop and re-run migration

**Error: "permission denied"**
- Ensure you're using the correct Supabase project
- Check project link: `.\bin\supabase.exe projects list`

### Deployment Fails

**Build Errors:**
- Run `npm run build` locally first
- Fix any TypeScript errors
- Ensure all dependencies installed: `npm install`

**Vercel Deployment Errors:**
- Check environment variables in Vercel Dashboard
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Check build logs in Vercel Dashboard

### Application Errors

**"Table does not exist"**
- Migration may not have been applied
- Verify tables in Supabase Dashboard
- Re-run migration if needed

**"Permission denied" or RLS errors**
- Verify RLS policies were created
- Check policies in Supabase Dashboard → Authentication → Policies
- Ensure user is authenticated

**Forms not opening**
- Check browser console for errors
- Verify Modal/Drawer components are imported correctly
- Test on mobile device (should use Drawer, not Modal)

## Success Criteria

✅ **Database:**
- Tables `products` and `stock_ledger` exist
- RLS policies active
- Indexes created

✅ **Application:**
- Builds successfully
- Deploys to Vercel
- Loads at production URL
- All features functional

✅ **Testing:**
- Product CRUD works
- Stock ledger works
- RLS isolation verified
- Mobile PWA works

## Support

- **Supabase Dashboard:** https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Production URL:** https://biz-finetune-store.vercel.app

