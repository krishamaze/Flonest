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
- [ ] Platform admin SSO + MFA controls validated
  - [ ] Platform admin emails configured in `profiles.platform_admin = true` (server-side only, no client exposure)
  - [ ] Google Workspace OAuth application configured in Supabase Auth (`google` provider)
  - [ ] `VITE_PLATFORM_ADMIN_SSO_PROVIDER` and `VITE_PLATFORM_ADMIN_SSO_REDIRECT` set
  - [ ] Break-glass account stored in managed HSM with dual-control checkout (Google Cloud KMS or AWS CloudHSM)
  - [ ] Manual password reset workflow documented (dual approval, no email reset links)
  - [ ] `VITE_PLATFORM_ADMIN_IDLE_TIMEOUT_MS` / `VITE_PLATFORM_ADMIN_MAX_SESSION_MS` tuned for 15m idle / 8h absolute
  - [ ] Login flow auto-detects admins: Enter email → server checks → auto-redirects to SSO if admin

### Testing
- [ ] Authentication flow tested
- [ ] All routes accessible
- [ ] Mobile responsive design verified
- [ ] PWA installation tested on mobile
- [ ] Offline functionality works
- [ ] Service worker registers correctly
- [ ] Pull-to-refresh tested on all pages

## Deployment

### Vercel Setup
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Framework preset set to "Vite"
- [ ] Root directory set to `.` (or leave empty)
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Install command: `npm install`

### Environment Variables in Vercel
- [ ] `VITE_SUPABASE_URL` added (Production)
- [ ] `VITE_SUPABASE_ANON_KEY` added (Production)
- [ ] `VITE_SUPABASE_URL` added (Preview)
- [ ] `VITE_SUPABASE_ANON_KEY` added (Preview)
- [ ] Environment variables encrypted

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
- [ ] Test pull-to-refresh update detection

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

---

## Update Detection System

### Service Worker Auto-Detection (No Manual Version Management!)

**How It Works:**
- Service Worker automatically detects new builds by comparing bundle hashes
- Works for ANY code change (no version updates needed!)
- Pull-to-refresh triggers: `serviceWorkerRegistration.update()`
- If new bundle found → Shows yellow update button
- User taps → App reloads with latest code

**What This Means:**
- ✅ No `package.json` version updates required
- ✅ No database version table needed
- ✅ No GitHub Actions for version sync
- ✅ Works automatically for every deployment
- ✅ More reliable (browser-native mechanism)

**Deployment Workflow:**
```bash
# Make ANY change
git add .
git commit -m "your changes"
git push origin main

# Service Worker detects new bundle automatically
# Pull-to-refresh shows update immediately
```

---

## Schema Changes (Manual Process)

**⚠️ Important**: Schema changes are high-risk and require manual review, testing, and backups.

### Pre-Migration
- [ ] Migration SQL reviewed for correctness
- [ ] Check for breaking changes
- [ ] Verify rollback SQL is possible
- [ ] Peer review completed (if team)
- [ ] Migration tested in staging environment
- [ ] API contracts verified in staging
- [ ] Frontend compatibility tested in staging
- [ ] Rollback procedure tested in staging

### Database Backup
- [ ] Database backup created before production migration
- [ ] Backup stored securely
- [ ] Backup location documented
- [ ] Backup verified (can be restored)

### Migration Execution
- [ ] Migration applied to production database using Supabase MCP `apply_migration`
- [ ] Migration monitored for errors
- [ ] Migration success verified
- [ ] No constraint violations detected
- [ ] API contracts verified in production

### Post-Migration
- [ ] Supabase logs monitored for schema-related errors
- [ ] Constraint violations monitored
- [ ] API contracts verified
- [ ] Frontend functionality tested
- [ ] User data integrity verified
- [ ] Performance impact assessed

### Rollback Plan
- [ ] Rollback SQL documented and tested
- [ ] Rollback procedure documented
- [ ] Rollback can be executed if needed
- [ ] Data restoration plan (if needed)
- [ ] Communication plan for users (if rollback needed)

---

## Quick Deploy Commands

### Subsequent Deployments
```bash
# Via Git (recommended - triggers Vercel auto-deploy)
git add .
git commit -m "Your changes"
git push origin main

# Service Worker handles update detection automatically
# No version management needed!
```

### Emergency Rollback
```bash
vercel rollback
```

---

## Platform Admin Access Architecture

- **Identity Provider:** Google Workspace. Configure Supabase Auth `google` provider with the corporate Google Cloud project OAuth credentials. Set `VITE_PLATFORM_ADMIN_SSO_PROVIDER=google` and `VITE_PLATFORM_ADMIN_SSO_REDIRECT=/platform-admin`.
- **Flow:** Login page auto-detects platform admins server-side (no client-side email list exposure). User enters email + password → server checks `profiles.platform_admin` → if admin, automatically redirects to Google SSO. After the OAuth callback, the app enforces Supabase MFA (`aal2`) via the dedicated `/admin-mfa` route before unlocking platform-admin routes.
- **Session Binding:** `PlatformAdminSessionWatcher` ties platform admin sessions to the issuing device fingerprint (UA + platform + language) and enforces 15m idle / 8h absolute lifetimes. Any mismatch forces sign-out and a new SSO + MFA cycle.
- **Manual Reset Workflow:** `resetPasswordForEmail` short-circuits for privileged identities. Password resets require a ticket approved by two platform leads, after which the temporary credential is injected via the managed HSM and rotated immediately after use.
- **Break-Glass Account:** A single emergency credential is stored in an HSM-backed vault (Google Cloud KMS or AWS CloudHSM). Access requires dual control, generates immutable audit logs, and demands on-device TOTP before platform admin access even when SSO is bypassed.
- **Operational Tasks:** Review Google Workspace security logs + HSM access logs weekly, rotate Google OAuth client secrets quarterly, and verify the `/admin-mfa` flow in production after every deployment.
- **Won't Do:** The product will never ship a home-grown MFA stack for admins; enforcement stays inside Google Workspace (SSO) + Supabase MFA APIs.

## Support Contacts

- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **Project Repository:** https://github.com/krishamaze/biz.finetune.store

---

**Last Updated:** 2025-11-13  
**Version System:** Service Worker Auto-Detection (No Manual Versioning)

---
