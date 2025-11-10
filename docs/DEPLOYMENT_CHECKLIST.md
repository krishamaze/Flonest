# Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed
- [ ] Build completes successfully (`npm run build`)
- [ ] Preview build works locally (`npm run preview`)
- [ ] No console errors in browser DevTools

### Environment Variables
- [ ] `.env.example` is up to date
- [ ] All required env vars documented
- [ ] Production Supabase credentials ready
- [ ] Environment variables added to Vercel dashboard

### PWA Assets
- [ ] PWA icons generated and added to `public/`:
  - [ ] `pwa-192x192.png`
  - [ ] `pwa-512x512.png`
  - [ ] `apple-touch-icon.png`
  - [ ] `favicon.ico`
  - [ ] `mask-icon.svg` (optional)
- [ ] `manifest.webmanifest` updated with correct app name
- [ ] `manifest.webmanifest` has correct `start_url`
- [ ] Theme colors match brand

### Configuration
- [ ] `vercel.json` is present and configured
- [ ] `.vercelignore` excludes unnecessary files
- [ ] `package.json` has correct build scripts
- [ ] Node.js version specified (18.x)

### Database
- [ ] Supabase tables created
- [ ] Row Level Security (RLS) policies enabled
- [ ] Test data added (optional)
- [ ] Database migrations documented
- [ ] Backup strategy in place

### Security
- [ ] `.env` file in `.gitignore`
- [ ] No secrets committed to Git
- [ ] Supabase RLS policies tested
- [ ] CORS settings configured in Supabase
- [ ] Security headers configured in `vercel.json`

### Testing
- [ ] Authentication flow tested
- [ ] All routes accessible
- [ ] Mobile responsive design verified
- [ ] PWA installation tested on mobile
- [ ] Offline functionality works
- [ ] Service worker registers correctly

## Deployment

### Vercel Setup
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Framework preset set to "Vite"
- [ ] Root directory set to `biz.finetune.store`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Install command: `npm install`

### Environment Variables in Vercel
- [ ] `VITE_SUPABASE_URL` added (Production)
- [ ] `VITE_SUPABASE_ANON_KEY` added (Production)
- [ ] `VITE_SUPABASE_URL` added (Preview)
- [ ] `VITE_SUPABASE_ANON_KEY` added (Preview)
- [ ] Environment variables encrypted

### GitHub Secrets (for Version Updates)
- [ ] `SUPABASE_URL` added to GitHub Secrets
- [ ] `SUPABASE_SERVICE_KEY` added to GitHub Secrets (service role key, not anon key)
- [ ] GitHub Action workflow enabled (`.github/workflows/update-db-version.yml`)
- [ ] Version update workflow tested

### Deployment
- [ ] Initial deployment successful
- [ ] Build logs reviewed (no errors)
- [ ] Deployment URL accessible
- [ ] All pages load correctly
- [ ] No 404 errors on routes

## Post-Deployment

### Verification
- [ ] Visit deployment URL
- [ ] Test login/authentication
- [ ] Navigate all routes
- [ ] Test on mobile device
- [ ] Install PWA on mobile
- [ ] Test offline mode
- [ ] Check service worker in DevTools
- [ ] Verify manifest in DevTools
- [ ] Verify version sync (frontend version matches database version)
- [ ] Check GitHub Actions log for version update success
- [ ] Test version notification (if versions are out of sync, notification should appear)

### Supabase Configuration
- [ ] Add Vercel URL to Supabase allowed origins
- [ ] Update redirect URLs in Supabase Auth settings:
  - [ ] `https://your-app.vercel.app/**`
  - [ ] `https://your-custom-domain.com/**` (if applicable)
- [ ] Test authentication with production URL
- [ ] Verify database queries work

### Performance
- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals:
  - [ ] LCP (Largest Contentful Paint) < 2.5s
  - [ ] FID (First Input Delay) < 100ms
  - [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] PWA score > 80
- [ ] Performance score > 90
- [ ] Accessibility score > 90

### Monitoring
- [ ] Vercel Analytics enabled
- [ ] Error tracking configured (optional: Sentry)
- [ ] Uptime monitoring set up (optional)
- [ ] Performance monitoring active

### Custom Domain (Optional)
- [ ] Domain added in Vercel
- [ ] DNS configured
- [ ] SSL certificate provisioned
- [ ] HTTPS working
- [ ] Redirects configured (www → non-www or vice versa)

### Documentation
- [ ] README.md updated with deployment URL
- [ ] DEPLOYMENT.md reviewed
- [ ] Team notified of deployment
- [ ] Deployment notes documented

## Rollback Plan

### If Issues Occur
- [ ] Previous deployment URL saved
- [ ] Rollback procedure documented:
  ```bash
  # Via Vercel Dashboard
  # 1. Go to Deployments
  # 2. Find previous working deployment
  # 3. Click "..." → "Promote to Production"
  
  # Via CLI
  vercel rollback
  ```
- [ ] Database rollback plan (if schema changed)
- [ ] Communication plan for users

## Continuous Deployment

### GitHub Integration
- [ ] Repository connected to Vercel
- [ ] Auto-deploy on push to `main` enabled
- [ ] Preview deployments for PRs enabled
- [ ] Branch protection rules configured
- [ ] CI/CD workflow tested

### Branch Strategy
- [ ] `main` → Production
- [ ] `develop` → Preview (optional)
- [ ] Feature branches → Preview URLs
- [ ] PR reviews required before merge

## Maintenance

### Regular Tasks
- [ ] Monitor deployment logs weekly
- [ ] Review Vercel Analytics monthly
- [ ] Update dependencies monthly
- [ ] Rotate Supabase keys quarterly
- [ ] Review and update RLS policies
- [ ] Backup database regularly

### Updates
- [ ] Process for deploying updates documented
- [ ] Staging environment for testing (optional)
- [ ] User notification for major updates
- [ ] Changelog maintained

### App Version Management
- [ ] Update version in `package.json` before deploying
- [ ] Update `FRONTEND_VERSION` in `src/lib/api/version.ts` to match `package.json`
- [ ] GitHub Action automatically updates database app version after deployment
- [ ] Verify app version sync after deployment (frontend/backend app versions match)
- [ ] GitHub Secrets configured:
  - [ ] `SUPABASE_URL` - Supabase project URL
  - [ ] `SUPABASE_SERVICE_KEY` - Supabase service role key (not anon key)

### Schema Changes (Manual Process)

**⚠️ Important**: Schema changes are high-risk and require manual review, testing, and backups. They are NOT automated like app version updates.

#### Pre-Migration
- [ ] Migration SQL reviewed for correctness
- [ ] Check for breaking changes
- [ ] Verify rollback SQL is possible
- [ ] Peer review completed (if team)
- [ ] Migration tested in staging environment
- [ ] API contracts verified in staging
- [ ] Frontend compatibility tested in staging
- [ ] Rollback procedure tested in staging

#### Database Backup
- [ ] Database backup created before production migration
- [ ] Backup stored securely
- [ ] Backup location documented
- [ ] Backup verified (can be restored)

#### Migration Execution
- [ ] Migration applied to production database
- [ ] Migration monitored for errors
- [ ] Migration success verified
- [ ] No constraint violations detected
- [ ] API contracts verified in production

#### Version Update
- [ ] Schema version updated (choose one method):
  
  **Option A: Via GitHub Action Workflow (Recommended)**
  - [ ] GitHub Action workflow triggered
  - [ ] Workflow inputs provided (migration file, schema version, etc.)
  - [ ] Workflow completed successfully
  - [ ] Schema version updated in database
  - [ ] Rollback SQL stored in database
  
  **Option B: Manual Update**
  - [ ] Schema version updated via RPC:
    ```sql
    SELECT update_app_version(
      '1.0.1',  -- App version (if also updated)
      'Migration release notes',
      '2.1.0',  -- Schema version
      'ROLLBACK SQL HERE'  -- Rollback SQL
    );
    ```
  - [ ] Rollback SQL stored in database
  
- [ ] App version updated (if schema change requires frontend updates)
- [ ] Version update verified
- [ ] See [Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md) for detailed guide

#### Post-Migration
- [ ] Supabase logs monitored for schema-related errors
- [ ] Version notification alerts checked
- [ ] Constraint violations monitored
- [ ] API contracts verified
- [ ] Frontend functionality tested
- [ ] User data integrity verified
- [ ] Performance impact assessed

#### Rollback Plan
- [ ] Rollback SQL documented and tested
- [ ] Rollback procedure documented
- [ ] Rollback can be executed if needed
- [ ] Data restoration plan (if needed)
- [ ] Communication plan for users (if rollback needed)

---

## Quick Deploy Commands

### First Time Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd biz.finetune.store
vercel --prod
```

### Subsequent Deployments
```bash
# 1. Update version in package.json (e.g., 1.0.0 → 1.0.1)
# 2. Update FRONTEND_VERSION in src/lib/api/version.ts to match

# Via Git (recommended)
git add .
git commit -m "Your changes"
git push origin main

# GitHub Action will automatically:
# - Deploy to Vercel (via auto-deploy)
# - Update database version after successful deployment

# Via CLI (if needed)
vercel --prod
```

### Emergency Rollback
```bash
vercel rollback
```

---

## Support Contacts

- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **Project Lead:** [Your Name/Email]
- **DevOps:** [Team Contact]

---

**Last Updated:** 2025-11-09  
**Next Review:** [Set date for next review]

---

## App Version Update Workflow

### Automatic App Version Updates

After deploying to production, the GitHub Action (`.github/workflows/update-db-version.yml`) automatically updates the database app version:

1. **Trigger**: Push to `main` branch that modifies `package.json` or `src/lib/api/version.ts`
2. **Extract**: App version from `package.json`
3. **Update**: Database via Supabase RPC function `update_app_version()`
4. **Result**: Frontend and backend app versions stay in sync
5. **Note**: Only updates app version, NOT schema version

### Manual App Version Update (if needed)

If the GitHub Action fails or you need to update manually:

```sql
-- Via Supabase SQL Editor
SELECT update_app_version('1.0.1', 'Your release notes here');
```

### Schema Version Update (Manual Process)

Schema versions are updated manually after schema migrations. See [Schema Changes Checklist](#schema-changes-manual-process) above.

**Option A: Via GitHub Action Workflow (Recommended)**
1. Go to GitHub repository → Actions
2. Select "Schema Migration" workflow
3. Click "Run workflow"
4. Fill in workflow inputs
5. Workflow applies migration and updates schema version

**Option B: Manual Schema Version Update**
```sql
-- Via Supabase SQL Editor
-- If updating app version too:
SELECT update_app_version(
  '1.0.1',  -- App version
  'Schema migration release notes',
  '2.1.0',  -- Schema version
  'ROLLBACK SQL HERE'  -- Rollback SQL (optional)
);

-- If keeping current app version (schema-only update):
SELECT update_app_version(
  (SELECT version FROM app_versions WHERE is_current = true LIMIT 1),  -- Keep current app version
  'Schema migration release notes',
  '2.1.0',  -- Schema version
  'ROLLBACK SQL HERE'  -- Rollback SQL (optional)
);
```

**For detailed workflow guide, see [Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md)**

### Troubleshooting Version Sync

**Issue: App versions are out of sync**
- Check GitHub Actions log for errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` secrets are set correctly
- Manually update database app version if needed (see above)

**Issue: Schema versions are out of sync**
- Verify schema migration was completed
- Check if schema version was updated after migration
- Manually update schema version if needed (see above)
- Verify schema version matches current database structure

**Issue: Version notification not showing**
- Check browser console for version check errors
- Verify frontend can reach Supabase API
- Check network connectivity
- Verify service worker is registered
- Note: Version notifications check app versions only, not schema versions

