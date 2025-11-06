# M3 Production Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migration Verification
- [x] Migration file created: `supabase/migrations/20251106020000_create_products_stock_ledger.sql`
- [x] RLS policies use `current_user_org_id()` helper (optimized)
- [x] Foreign keys use `RESTRICT` (not CASCADE)
- [x] Partial unique index on (org_id, sku) WHERE status = 'active'
- [ ] Migration tested locally (if possible)

### 2. Code Verification
- [x] All TypeScript types updated
- [x] API functions created and tested
- [x] UI components created
- [x] Forms integrated into pages
- [x] No linter errors
- [ ] Build succeeds: `npm run build`

### 3. Environment Variables
- [ ] Verify `VITE_SUPABASE_URL` is set in Vercel
- [ ] Verify `VITE_SUPABASE_ANON_KEY` is set in Vercel

## Deployment Sequence

### Step 1: Database Migration (CRITICAL - Do First)

**Option A: Using Supabase CLI (Recommended)**
```bash
# Ensure you're linked to production project
.\bin\supabase.exe link --project-ref yzrwkznkfisfpnwzbwfw

# Push migration to production
.\bin\supabase.exe db push
```

**Option B: Using Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/20251106020000_create_products_stock_ledger.sql`
4. Paste and execute
5. Verify tables created: `products` and `stock_ledger`
6. Verify RLS policies exist

**Verification:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
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

### Step 2: Code Deployment to Vercel

**Option A: Using Vercel CLI**
```bash
# Deploy to production
vercel --prod
```

**Option B: Using Git Push (if connected)**
```bash
git add .
git commit -m "M3: Add products and stock_ledger CRUD"
git push origin main
# Vercel will auto-deploy
```

**Option C: Using Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select project: biz-finetune-store
3. Click "Deployments" → "Create Deployment"
4. Upload or connect repository

### Step 3: Post-Deployment Verification

#### 3.1 Database Verification
- [ ] Tables exist in production Supabase
- [ ] RLS policies are active
- [ ] Indexes created successfully
- [ ] Can query products table (with proper auth)

#### 3.2 Application Verification
- [ ] App loads at https://biz-finetune-store.vercel.app
- [ ] Login works with demo@example.com
- [ ] Products page loads
- [ ] Can create new product
- [ ] Can edit product
- [ ] Can delete product (soft delete)
- [ ] Stock ledger page loads
- [ ] Can create stock transaction
- [ ] Filters work on stock ledger

## Testing Checklist

### Mobile Device Testing
- [ ] Install PWA on mobile device
- [ ] Test product creation on mobile
- [ ] Test product editing on mobile
- [ ] Test stock transaction creation
- [ ] Verify drawer opens on mobile (not modal)
- [ ] Test form validation on mobile
- [ ] Test search functionality
- [ ] Test filter buttons on stock ledger

### Data Integrity Testing
- [ ] Create product in one org
- [ ] Verify product not visible in another org (RLS test)
- [ ] Create stock transaction
- [ ] Verify transaction appears in ledger
- [ ] Test SKU uniqueness per org
- [ ] Test soft delete (status = 'inactive')

### Performance Testing
- [ ] Product list loads quickly
- [ ] Stock ledger loads quickly
- [ ] Search is responsive
- [ ] Filters work smoothly
- [ ] Forms submit without lag

### Error Handling
- [ ] Duplicate SKU shows error
- [ ] Invalid form data shows validation errors
- [ ] Network errors handled gracefully
- [ ] RLS violations show appropriate errors

## Rollback Plan

If issues occur:

### Database Rollback
```sql
-- Drop tables (if needed)
DROP TABLE IF EXISTS stock_ledger CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Drop policies
DROP POLICY IF EXISTS "products_tenant_isolation" ON products;
DROP POLICY IF EXISTS "stock_ledger_tenant_isolation" ON stock_ledger;
```

### Code Rollback
```bash
# Revert to previous deployment in Vercel dashboard
# Or redeploy previous git commit
git checkout <previous-commit>
vercel --prod
```

## Production URLs

- **Application**: https://biz-finetune-store.vercel.app
- **Supabase Dashboard**: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw
- **Vercel Dashboard**: https://vercel.com/dashboard

## Demo User Credentials

- **Email**: demo@example.com
- **Password**: (check Supabase Auth or environment)

## Support Resources

- Supabase Migration Docs: https://supabase.com/docs/guides/cli/local-development#database-migrations
- Vercel Deployment Docs: https://vercel.com/docs/deployments/overview

