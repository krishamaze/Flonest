# Vercel Deployment Guide

Complete guide for deploying the biz.finetune.store React PWA to Vercel.

## Prerequisites

- Vercel account (free tier works)
- GitHub repository (recommended for auto-deployment)
- Supabase project with credentials

## Deployment Methods

### Method 1: Deploy via Vercel CLI (Fastest)

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy from project directory
```bash
cd biz.finetune.store
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No
- **Project name?** biz-finetune-store (or your preferred name)
- **Directory?** ./ (current directory)
- **Override settings?** No

#### 4. Add environment variables
```bash
vercel env add VITE_SUPABASE_URL
# Paste your Supabase URL when prompted

vercel env add VITE_SUPABASE_ANON_KEY
# Paste your Supabase anon key when prompted
```

Select environments:
- Production: Yes
- Preview: Yes
- Development: Yes (optional)

#### 5. Deploy to production
```bash
vercel --prod
```

---

### Method 2: Deploy via Vercel Dashboard (Recommended for GitHub)

#### 1. Push to GitHub
```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

#### 2. Import Project in Vercel
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Configure project:
   - **Framework Preset:** Vite
   - **Root Directory:** `biz.finetune.store`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

#### 3. Add Environment Variables
In the "Environment Variables" section, add:

| Name | Value | Environments |
|------|-------|--------------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | Production, Preview, Development |

**Get these from:** Supabase Dashboard → Project Settings → API

#### 4. Deploy
Click "Deploy" and wait for the build to complete (~2-3 minutes)

---

## Configuration Details

### vercel.json Explained

```json
{
  "buildCommand": "npm run build",        // Vite production build
  "outputDirectory": "dist",              // Vite output folder
  "framework": "vite",                    // Auto-detected framework
  "installCommand": "npm install",        // Install dependencies
  "rewrites": [                           // SPA routing support
    {
      "source": "/(.*)",
      "destination": "/index.html"        // All routes → index.html
    }
  ],
  "headers": [                            // PWA & security headers
    // Service worker headers
    // Manifest headers
    // Cache control
    // Security headers
  ]
}
```

### Environment Variables

**Required for Production (Vercel):**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Required for Version Updates (GitHub Secrets):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key (⚠️ Keep secret!)

**Optional:**
- `NODE_VERSION` - Set to 18 (configured in vercel.json)

**Important Notes:**
- All client-side env vars must be prefixed with `VITE_`
- Never commit `.env` file to Git
- Use Vercel's environment variable UI for secrets
- Use GitHub Secrets for `SUPABASE_SERVICE_KEY` (not Vercel env vars)
- Same Supabase project can be used for preview/production
- Service role key bypasses RLS - only use for automated scripts

---

## Deployment Workflow

### Automatic Deployments (GitHub Integration)

**Production Deployment:**
```bash
# 1. Update version in package.json (e.g., 1.0.0 → 1.0.1)
# 2. Update FRONTEND_VERSION in src/lib/api/version.ts to match
# 3. Commit and push
git add .
git commit -m "Release v1.0.1: Your changes"
git push origin main
```
- Triggers production deployment to Vercel
- GitHub Action automatically updates database version after deployment
- URL: https://biz-finetune-store.vercel.app
- Custom domain: Configure in Vercel dashboard

**Preview Deployments:**
```bash
git checkout -b feature/new-feature
git push origin feature/new-feature
```
- Triggers preview deployment
- URL: https://biz-finetune-store-git-feature-new-feature.vercel.app
- Unique URL for each branch/PR
- Version updates do not run for preview deployments (only production)

**Pull Request Deployments:**
- Automatic preview deployment for each PR
- Comment with preview URL added to PR
- Updates on each commit to PR

### Manual Deployments (CLI)

**Deploy to preview:**
```bash
vercel
```

**Deploy to production:**
```bash
vercel --prod
```

**Deploy specific branch:**
```bash
git checkout feature-branch
vercel
```

---

## Custom Domain Setup

### 1. Add Domain in Vercel
1. Go to Project Settings → Domains
2. Add your domain: `biz.finetune.store`
3. Follow DNS configuration instructions

### 2. DNS Configuration

**Option A: Vercel Nameservers (Recommended)**
Update your domain's nameservers to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**Option B: CNAME Record**
Add CNAME record:
- Name: `@` or `www`
- Value: `cname.vercel-dns.com`

### 3. SSL Certificate
- Automatically provisioned by Vercel
- Usually ready within 24 hours
- Free Let's Encrypt certificate

---

## PWA Deployment Checklist

### Before Deploying

- [ ] Add PWA icons to `public/` directory:
  - `pwa-192x192.png`
  - `pwa-512x512.png`
  - `apple-touch-icon.png`
  - `favicon.ico`

- [ ] Update `public/manifest.webmanifest`:
  - Set correct `start_url`
  - Update app name
  - Verify icon paths

- [ ] Test build locally:
  ```bash
  npm run build
  npm run preview
  ```

- [ ] Verify environment variables:
  - Check `.env.example` for required vars
  - Ensure all `VITE_` prefixed vars are set in Vercel

### After Deploying

- [ ] Test PWA installation on mobile
- [ ] Verify service worker registration
- [ ] Test offline functionality
- [ ] Check manifest in DevTools (Application tab)
- [ ] Test on multiple devices/browsers
- [ ] Verify HTTPS is working
- [ ] Test all routes (SPA routing)

---

## Monitoring & Analytics

### Vercel Analytics (Built-in)
1. Go to Project → Analytics
2. View:
   - Page views
   - Unique visitors
   - Top pages
   - Performance metrics

### Enable Web Vitals
Add to `src/main.tsx`:
```typescript
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
  // Send to Vercel Analytics
  const body = JSON.stringify(metric)
  const url = 'https://vitals.vercel-analytics.com/v1/vitals'
  
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body)
  }
}

onCLS(sendToAnalytics)
onFID(sendToAnalytics)
onFCP(sendToAnalytics)
onLCP(sendToAnalytics)
onTTFB(sendToAnalytics)
```

---

## Troubleshooting

### Build Fails

**Error: "Missing environment variables"**
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel dashboard
- Ensure variables are set for correct environment (Production/Preview)

**Error: "Command failed: npm run build"**
- Check build logs in Vercel dashboard
- Test build locally: `npm run build`
- Verify all dependencies are in `package.json`

### Routing Issues

**404 on page refresh**
- Verify `vercel.json` has rewrites configuration
- Check that `"source": "/(.*)"` points to `/index.html`

**Assets not loading**
- Check asset paths are relative (not absolute)
- Verify `base` in `vite.config.ts` is correct

### PWA Issues

**Service worker not registering**
- Check HTTPS is enabled (required for PWA)
- Verify `sw.js` is in `dist/` after build
- Check browser console for errors

**App not installable**
- Add all required PWA icons
- Verify `manifest.webmanifest` is accessible
- Check manifest in DevTools → Application → Manifest

### Performance Issues

**Slow initial load**
- Enable code splitting in Vite
- Optimize images (use WebP)
- Check bundle size: `npm run build -- --mode analyze`

**Service worker caching issues**
- Clear service worker cache
- Update service worker version
- Check Workbox configuration in `vite.config.ts`

### Version Sync Issues

**Versions are out of sync**
- Check GitHub Actions log for version update errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` secrets are set in GitHub
- Manually update database version if needed:
  ```sql
  SELECT update_app_version('1.0.1', 'Manual update');
  ```
- Verify frontend version matches database version

**Version notification not showing**
- Check browser console for version check errors
- Verify frontend can reach Supabase API
- Check network connectivity
- Verify service worker is registered
- Test version check: Open DevTools → Network → Look for `get_current_app_version` call

---

## Environment-Specific Configuration

### Production
```bash
# .env.production (not committed)
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key
```

### Preview/Staging
```bash
# Use same Supabase project or separate staging project
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging-anon-key
```

### Development
```bash
# .env.development.local (not committed)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=local-anon-key
```

---

## Deployment Commands Reference

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# List deployments
vercel ls

# View deployment logs
vercel logs [deployment-url]

# Add environment variable
vercel env add [name]

# List environment variables
vercel env ls

# Remove deployment
vercel rm [deployment-url]

# Link local project to Vercel project
vercel link

# Pull environment variables to local
vercel env pull
```

---

## Security Best Practices

1. **Never commit secrets**
   - Use `.env` for local development
   - Use Vercel dashboard for production secrets
   - Keep `.env` in `.gitignore`

2. **Use environment-specific keys**
   - Different Supabase projects for prod/staging
   - Rotate keys periodically
   - Use RLS policies in Supabase

3. **Enable security headers**
   - Already configured in `vercel.json`
   - CSP, X-Frame-Options, etc.

4. **Monitor deployments**
   - Review deployment logs
   - Set up error tracking (Sentry, etc.)
   - Monitor Vercel Analytics

---

## Next Steps After Deployment

1. **Test the deployed app:**
   - Visit your Vercel URL
   - Test all features
   - Install as PWA on mobile

2. **Set up custom domain:**
   - Add domain in Vercel
   - Configure DNS
   - Wait for SSL certificate

3. **Configure Supabase:**
   - Add Vercel URL to allowed origins
   - Update redirect URLs for auth
   - Test authentication flow

4. **Set up GitHub Secrets for version updates:**
   - Go to GitHub repository → Settings → Secrets and variables → Actions
   - Add `SUPABASE_URL` secret (your Supabase project URL)
   - Add `SUPABASE_SERVICE_KEY` secret (service role key from Supabase Dashboard → API)
   - Verify GitHub Action workflow (`.github/workflows/update-db-version.yml`) is enabled
   - Test by pushing a version update to `main` branch

5. **Monitor and optimize:**
   - Check Vercel Analytics
   - Monitor Web Vitals
   - Optimize based on metrics
   - Verify version sync after deployments

---

**Deployment URL:** https://biz-finetune-store.vercel.app (after deployment)

---

## Version Update System

### App Version vs Schema Version

The version system tracks two separate types of changes:

- **App Version (Frontend Code)**: Tracks frontend code/UI changes (e.g., "1.0.1"). Changes frequently, low-risk, non-breaking. Automatically updated via GitHub Action on deployment.

- **Schema Version (Database Structure)**: Tracks database schema changes (e.g., "2.3.0"). Changes rarely, high-risk, can be breaking. Requires manual process with review, testing, and backups.

**Important**: App version updates are automated and safe. Schema version changes require careful planning and manual execution. See [Schema Change Workflow](#schema-change-workflow) below.

### App Version Workflow (Automated)

**How It Works:**

1. **Developer updates version:**
   - Updates `version` in `package.json`
   - Updates `FRONTEND_VERSION` in `src/lib/api/version.ts`
   - Commits and pushes to `main` branch

2. **Vercel deploys:**
   - Auto-deploys on push to `main`
   - New frontend code with updated version is deployed

3. **GitHub Action updates database:**
   - Triggers on push to `main` that modifies `package.json` or `src/lib/api/version.ts`
   - Extracts version from `package.json`
   - Calls Supabase RPC function `update_app_version()`
   - Updates **app version** only (not schema version)
   - No schema impact - only updates version record

4. **Users get notified:**
   - Frontend checks version on app mount, visibility change, or network reconnect
   - If app versions don't match, notification appears
   - User taps to refresh and get new version

### Version Check Frequency

The app checks for version updates:
- On app mount (initial check)
- When app becomes visible (user returns to app)
- When network reconnects (user comes back online)
- Every 30 minutes as fallback (long-running sessions)

This ensures users are notified of updates without excessive battery drain.

### Manual App Version Update

If the GitHub Action fails, you can manually update the app version:

```sql
-- Via Supabase SQL Editor
SELECT update_app_version('1.0.1', 'Your release notes here');
```

### Schema Change Workflow (Manual)

**⚠️ Important**: Schema changes are high-risk and require manual review, testing, and backups. They are NOT automated.

**When to Update Schema Version:**
- Adding/removing columns from tables
- Creating/dropping tables
- Changing column types
- Adding/removing indexes or constraints
- Any structural database changes

**Schema Change Process:**

1. **Create Migration File:**
   ```bash
   npm run supabase:migration:new add_new_column_to_products
   ```
   - Creates migration file in `supabase/migrations/`
   - Write SQL for schema change

2. **Review Migration:**
   - Review SQL for correctness
   - Check for breaking changes
   - Verify rollback SQL is possible
   - Get peer review (if team)

3. **Test in Staging:**
   - Apply migration to staging database
   - Test API contracts
   - Verify frontend compatibility
   - Test rollback procedure

4. **Backup Database:**
   - Create database backup before production migration
   - Store backup securely
   - Document backup location

5. **Apply Migration:**
   ```bash
   npm run db:migrate
   ```
   - Or apply via Supabase Dashboard SQL Editor
   - Monitor for errors
   - Verify migration success

6. **Update Schema Version:**
   
   **Option A: Via GitHub Action Workflow (Recommended)**
   - Go to GitHub repository → Actions
   - Select "Schema Migration" workflow
   - Click "Run workflow"
   - Fill in workflow inputs (migration file, schema version, etc.)
   - Workflow will apply migration and update schema version
   
   **Option B: Manual Update**
   ```sql
   -- Via Supabase SQL Editor
   SELECT update_app_version(
     '1.0.1',  -- App version (if also updated)
     'Added tax_rate column to products',  -- Release notes
     '2.1.0',  -- Schema version (NEW)
     'ALTER TABLE products DROP COLUMN tax_rate;'  -- Rollback SQL (optional)
   );
   ```
   
   **For detailed workflow guide, see [Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md)**

7. **Update App Version (if needed):**
   - If schema change requires frontend updates, also update app version
   - Frontend code should be deployed before or after schema migration
   - See [Version Coupling Guidelines](#version-coupling-guidelines) below

8. **Monitor for Errors:**
   - Watch Supabase logs for schema-related errors
   - Monitor version notification alerts
   - Check for constraint violations
   - Verify API contracts

**For detailed schema migration workflow, see:**
- [Schema Migrations Guide](./SCHEMA_MIGRATIONS.md) - Complete guide for schema changes
- [Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md) - GitHub Action workflow guide

### Version Coupling Guidelines

**When to pair schema changes with app version bumps:**
- Schema changes require frontend updates (e.g., new form fields for added columns)
- API contract changes (e.g., new required fields)
- Breaking changes that affect user experience
- New features that require both schema and frontend changes

**When schema changes can be independent:**
- Backend-only optimizations (e.g., adding indexes)
- Internal schema improvements (e.g., adding constraints)
- Performance improvements that don't affect API
- Data migrations that don't change API contracts

**Example - Coupled Change:**
```sql
-- Schema: Add email_verified column
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Update both versions
SELECT update_app_version(
  '1.1.0',  -- App version (frontend needs to handle new field)
  'Add email verification feature',
  '2.1.0',  -- Schema version
  'ALTER TABLE users DROP COLUMN email_verified;'  -- Rollback
);
```

**Example - Independent Change:**
```sql
-- Schema: Add index for performance
CREATE INDEX idx_products_category ON products(category);

-- Update schema version only (keep current app version)
-- First, get current app version, then update with same app version but new schema version
SELECT update_app_version(
  (SELECT version FROM app_versions WHERE is_current = true LIMIT 1),  -- Keep current app version
  'Add index for products category',
  '2.1.1',  -- Schema version (patch increment)
  'DROP INDEX idx_products_category;'  -- Rollback
);
```

**Need Help?** 
- Vercel Docs: https://vercel.com/docs
- Vite Deployment: https://vitejs.dev/guide/static-deploy.html
- PWA Deployment: https://vite-pwa-org.netlify.app/deployment/
- GitHub Actions: https://docs.github.com/en/actions

